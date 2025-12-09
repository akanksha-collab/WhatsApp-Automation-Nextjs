import { connectDB } from '@/lib/db/connect';
import { Entity, IEntityDocument } from '@/lib/db/models/Entity';
import { ScheduledPost } from '@/lib/db/models/ScheduledPost';
import { ScheduleSettings } from '@/lib/db/models/ScheduleSettings';
import { MessageTemplate, IMessageTemplateDocument } from '@/lib/db/models/MessageTemplate';
import { calculatePriorityForDate, EntityPriority } from './priority';
import { allocateSlots } from './slot-allocator';
import { 
  BatchContentSelector, 
  batchMarkContentAsUsed,
  hasYouTubePlaceholder,
} from './content-selector';
import { 
  findBestMatchingTemplate, 
  mapEntityPriorityToTemplatePriority,
  EntityPriorityLevel 
} from './template-matcher';
import { addDays, startOfWeek, startOfDay, endOfDay, format, differenceInDays, isBefore, isAfter, parse } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

interface GenerateScheduleParams {
  userId: string;
  weekStartDate?: string; // YYYY-MM-DD format string
}

interface GenerateDayScheduleParams {
  userId: string;
  targetDate?: string; // YYYY-MM-DD format string
}

export interface ScheduleGenerationResult {
  success: boolean;
  postsCreated: number;
  message: string;
  details?: {
    skippedPastSlots?: number;
    skippedExpiredEntities?: number;
  };
}

/**
 * Generate a unique key for tracking templates used per entity per day
 */
function getEntityDayKey(entityId: string, dateString: string): string {
  return `${entityId}-${dateString}`;
}

/**
 * Convert a date string (YYYY-MM-DD) to the start of day in a specific timezone.
 * Returns the UTC Date that corresponds to midnight on that date in the given timezone.
 */
function getStartOfDayInTimezone(dateString: string, timezone: string): Date {
  // Parse the date string as midnight in the specified timezone
  const dateTimeString = `${dateString} 00:00`;
  const localMidnight = parse(dateTimeString, 'yyyy-MM-dd HH:mm', new Date());
  return fromZonedTime(localMidnight, timezone);
}

/**
 * Convert a date string (YYYY-MM-DD) to the end of day in a specific timezone.
 * Returns the UTC Date that corresponds to 23:59:59.999 on that date in the given timezone.
 */
function getEndOfDayInTimezone(dateString: string, timezone: string): Date {
  // Parse the date string as end of day in the specified timezone
  const dateTimeString = `${dateString} 23:59`;
  const localEndOfDay = parse(dateTimeString, 'yyyy-MM-dd HH:mm', new Date());
  return fromZonedTime(localEndOfDay, timezone);
}

/**
 * Check if an entity's deadline has passed for a given date.
 * Entity should not receive posts after its Lead Plaintiff Deadline.
 * 
 * @param dateString - Date in YYYY-MM-DD format (represents the calendar date in user's timezone)
 */
function isEntityExpiredForDateString(entity: IEntityDocument, dateString: string, timezone: string): boolean {
  if (!entity.leadPlaintiffDate) return false;
  
  // Get the deadline as a YYYY-MM-DD string in user's timezone
  const deadlineInTz = toZonedTime(new Date(entity.leadPlaintiffDate), timezone);
  const deadlineDateString = format(deadlineInTz, 'yyyy-MM-dd');
  
  // Compare date strings directly (YYYY-MM-DD format sorts correctly)
  return dateString > deadlineDateString;
}

/**
 * Check if an entity's deadline has passed for a given UTC Date.
 * Entity should not receive posts after its Lead Plaintiff Deadline.
 */
function isEntityExpiredForDate(entity: IEntityDocument, date: Date, timezone: string): boolean {
  if (!entity.leadPlaintiffDate) return false;
  
  // Convert the UTC date to user's timezone and get the date string
  const dateInTz = toZonedTime(date, timezone);
  const dateString = format(dateInTz, 'yyyy-MM-dd');
  
  return isEntityExpiredForDateString(entity, dateString, timezone);
}

/**
 * Generate schedule for a single day using priority-based slot distribution.
 * 
 * Algorithm:
 * 1. Get all active entities and filter out expired ones
 * 2. Calculate priority for each entity based on days until deadline
 * 3. Allocate slots using fixed ratios (Critical: 40%, High: 30%, Medium: 20%, Low: 10%)
 * 4. Redistribute slots from empty priority levels
 * 5. Within each priority, distribute equally (extra to sooner deadlines)
 * 6. For each slot, select template and content
 * 7. Create scheduled posts
 * 
 * @param targetDate - Date in YYYY-MM-DD format (represents the calendar date in user's timezone)
 */
export async function generateDaySchedule({
  userId,
  targetDate,
}: GenerateDayScheduleParams): Promise<ScheduleGenerationResult> {
  await connectDB();
  
  // Get user's schedule settings
  const settings = await ScheduleSettings.findOne({ userId });
  if (!settings) {
    return {
      success: false,
      postsCreated: 0,
      message: 'Schedule settings not configured',
    };
  }
  
  // Get all active templates first (early check)
  const templates = await MessageTemplate.find({ userId, isActive: true }).lean() as IMessageTemplateDocument[];
  if (templates.length === 0) {
    return {
      success: false,
      postsCreated: 0,
      message: 'No templates found. Please create at least one message template.',
    };
  }
  
  // Determine target date (default to today in user's timezone)
  // If targetDate is provided as YYYY-MM-DD string, use it directly
  // Otherwise, get today's date in user's timezone
  let scheduleDateString: string;
  if (targetDate) {
    scheduleDateString = targetDate;
  } else {
    const nowInUserTz = toZonedTime(new Date(), settings.timezone);
    scheduleDateString = format(nowInUserTz, 'yyyy-MM-dd');
  }
  
  // Parse the date string for date-fns operations (for getting day name, etc.)
  // This creates a Date at midnight local time, which is fine for date comparisons
  const scheduleDate = parse(scheduleDateString, 'yyyy-MM-dd', new Date());
  const dayName = format(scheduleDate, 'EEEE').toLowerCase();
  
  // Get day settings
  const daySettings = settings.weeklySchedule.find(d => d.day === dayName);
  if (!daySettings?.isActive) {
    return {
      success: false,
      postsCreated: 0,
      message: `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} is not configured for scheduling.`,
    };
  }
  
  // Get active time slots
  const activeSlots = daySettings.timeSlots.filter(s => s.isActive);
  if (activeSlots.length === 0) {
    return {
      success: false,
      postsCreated: 0,
      message: 'No active time slots configured for this day.',
    };
  }
  
  // Get all active entities
  const entities = await Entity.find({ userId, status: 'active', isActive: true });
  
  // EDGE CASE: No active entities
  if (entities.length === 0) {
    return {
      success: false,
      postsCreated: 0,
      message: 'No active entities to schedule',
    };
  }
  
  // Filter out entities whose deadline has passed for this date
  // AND calculate priority for the specific schedule date (not today)
  const validEntities: EntityPriority[] = [];
  let skippedExpiredEntities = 0;
  
  for (const entity of entities) {
    // Skip if deadline is before the schedule date
    if (isEntityExpiredForDateString(entity, scheduleDateString, settings.timezone)) {
      skippedExpiredEntities++;
      continue;
    }
    
    // Calculate priority based on schedule date (not today)
    const priority = calculatePriorityForDate(entity, scheduleDate, settings);
    validEntities.push(priority);
  }
  
  if (validEntities.length === 0) {
    return {
      success: false,
      postsCreated: 0,
      message: 'All entities have expired deadlines for this date.',
      details: { skippedExpiredEntities },
    };
  }
  
  // Delete only PENDING posts for this day (keep SENT and FAILED)
  // Use timezone-aware date range for the query
  const dayStartUtc = getStartOfDayInTimezone(scheduleDateString, settings.timezone);
  const nextDayString = format(addDays(scheduleDate, 1), 'yyyy-MM-dd');
  const dayEndUtc = getStartOfDayInTimezone(nextDayString, settings.timezone);
  
  await ScheduledPost.deleteMany({
    userId,
    status: 'scheduled',
    isAutoGenerated: true,
    scheduledAt: {
      $gte: dayStartUtc,
      $lt: dayEndUtc,
    },
  });
  
  // Allocate slots using the new ratio-based algorithm
  // Pass the date string (YYYY-MM-DD) to ensure proper timezone handling
  const allocationResult = allocateSlots(
    validEntities,
    activeSlots,
    scheduleDateString,
    settings.timezone
  );
  
  // Generate posts
  const postsToCreate: Record<string, unknown>[] = [];
  const templateUsageUpdates: Map<string, number> = new Map();
  const usedTemplatesPerEntityDay: Map<string, Set<string>> = new Map();
  const contentSelector = new BatchContentSelector();
  
  let skippedPastSlots = 0;
  
  for (const allocation of allocationResult.allocations) {
    // Skip time slots that are already in the past
    if (isBefore(allocation.scheduledTime, new Date())) {
      skippedPastSlots++;
      continue;
    }
    
    // Double-check entity deadline for this specific time slot
    if (isEntityExpiredForDate(allocation.entity.entity, allocation.scheduledTime, settings.timezone)) {
      continue;
    }
    
    const entityId = allocation.entity.entity._id.toString();
    const templatePriority = mapEntityPriorityToTemplatePriority(allocation.entity.priorityLevel as EntityPriorityLevel);
    
    // Track used templates per entity per day for same-day exclusion
    const entityDayKey = getEntityDayKey(entityId, scheduleDateString);
    const usedTemplateIds = usedTemplatesPerEntityDay.get(entityDayKey) || new Set<string>();
    
    const templateMatch = findBestMatchingTemplate(
      templates,
      templatePriority,
      Array.from(usedTemplateIds)
    );
    
    let message: string;
    let usedTemplateId: string | undefined;
    let usedTemplateName: string | undefined;
    
    if (templateMatch) {
      message = applyTemplate(templateMatch.template.template, allocation.entity.entity);
      usedTemplateId = templateMatch.templateId;
      usedTemplateName = templateMatch.templateName;
      
      usedTemplateIds.add(usedTemplateId);
      usedTemplatesPerEntityDay.set(entityDayKey, usedTemplateIds);
      
      const currentCount = templateUsageUpdates.get(usedTemplateId) || 0;
      templateUsageUpdates.set(usedTemplateId, currentCount + 1);
    } else {
      message = generateDefaultMessage(allocation.entity.entity);
      usedTemplateName = 'Default Message (No Templates)';
    }
    
    // Select content
    const contentResult = await contentSelector.selectForPost(
      entityId,
      message,
      scheduleDate
    );
    
    let finalContentType: string = 'text';
    let contentId: string | undefined;
    let mediaUrl: string | undefined;
    
    if (contentResult.contentId && contentResult.contentType && contentResult.fileUrl) {
      finalContentType = contentResult.contentType;
      contentId = contentResult.contentId;
      mediaUrl = contentResult.fileUrl;
    } else if (hasYouTubePlaceholder(message)) {
      finalContentType = 'youtube';
    }
    
    postsToCreate.push({
      userId,
      entityId,
      contentType: finalContentType,
      contentId,
      mediaUrl,
      message,
      templateId: usedTemplateId,
      templateName: usedTemplateName,
      scheduledAt: allocation.scheduledTime,
      scheduledDay: dayName,
      timeSlotId: allocation.slotId,
      status: 'scheduled',
      priority: allocation.entity.score,
      isAutoGenerated: true,
    });
  }
  
  // EDGE CASE: All time slots are in the past
  if (postsToCreate.length === 0 && skippedPastSlots > 0) {
    return {
      success: false,
      postsCreated: 0,
      message: 'All time slots for today have passed',
      details: { skippedPastSlots },
    };
  }
  
  // Bulk insert posts
  if (postsToCreate.length > 0) {
    await ScheduledPost.insertMany(postsToCreate);
    
    // Update template usage counts
    for (const [templateId, usageCount] of templateUsageUpdates) {
      await MessageTemplate.findByIdAndUpdate(templateId, {
        $inc: { usageCount: usageCount },
        $set: { lastUsedAt: new Date() },
      });
    }
    
    // Update content usage counts
    const selectedContentIds = contentSelector.getAllSelectedContentIds();
    await batchMarkContentAsUsed(selectedContentIds);
  }
  
  return {
    success: true,
    postsCreated: postsToCreate.length,
    message: `Successfully scheduled ${postsToCreate.length} posts for ${format(scheduleDate, 'EEEE, MMMM d')}`,
    details: {
      skippedPastSlots,
      skippedExpiredEntities,
    },
  };
}

/**
 * Generate schedule for the week using priority-based slot distribution.
 * 
 * Important: Priority is recalculated for EACH day being scheduled,
 * because the days until deadline changes as we move through the week.
 * 
 * Algorithm (per day):
 * 1. Skip past days
 * 2. Get entities valid for that day (deadline not passed)
 * 3. Calculate priority for each entity based on THAT day's distance to deadline
 * 4. Allocate slots using fixed ratios (Critical: 40%, High: 30%, Medium: 20%, Low: 10%)
 * 5. Redistribute slots from empty priority levels
 * 6. Within each priority, distribute equally (extra to sooner deadlines)
 * 7. For each slot, select template and content
 * 8. Create scheduled posts
 * 
 * @param weekStartDate - Date in YYYY-MM-DD format (represents the Monday of the week in user's timezone)
 */
export async function generateWeeklySchedule({
  userId,
  weekStartDate,
}: GenerateScheduleParams): Promise<ScheduleGenerationResult> {
  await connectDB();
  
  // Get user's schedule settings
  const settings = await ScheduleSettings.findOne({ userId });
  if (!settings) {
    return {
      success: false,
      postsCreated: 0,
      message: 'Schedule settings not configured',
    };
  }
  
  // Get all active templates first (early check)
  const templates = await MessageTemplate.find({ userId, isActive: true }).lean() as IMessageTemplateDocument[];
  if (templates.length === 0) {
    return {
      success: false,
      postsCreated: 0,
      message: 'No templates found. Please create at least one message template.',
    };
  }
  
  // Get all active entities
  const entities = await Entity.find({ userId, status: 'active', isActive: true });
  
  // EDGE CASE: No active entities
  if (entities.length === 0) {
    return {
      success: false,
      postsCreated: 0,
      message: 'No active entities to schedule',
    };
  }
  
  // Determine week start string (YYYY-MM-DD format)
  // If weekStartDate is provided as YYYY-MM-DD string, use it directly
  // Otherwise, get Monday of current week in user's timezone
  let weekStartString: string;
  if (weekStartDate) {
    weekStartString = weekStartDate;
  } else {
    const nowInUserTz = toZonedTime(new Date(), settings.timezone);
    const weekStart = startOfWeek(nowInUserTz, { weekStartsOn: 1 });
    weekStartString = format(weekStart, 'yyyy-MM-dd');
  }
  
  // Parse the week start string for date operations
  const weekStartParsed = parse(weekStartString, 'yyyy-MM-dd', new Date());
  
  // Get "today" in user's timezone to skip past dates
  const nowInUserTz = toZonedTime(new Date(), settings.timezone);
  const todayString = format(nowInUserTz, 'yyyy-MM-dd');
  
  // Delete only PENDING posts for this week (keep SENT and FAILED)
  // Use timezone-aware date range for the query
  const weekStartUtc = getStartOfDayInTimezone(weekStartString, settings.timezone);
  const weekEndString = format(addDays(weekStartParsed, 7), 'yyyy-MM-dd');
  const weekEndUtc = getStartOfDayInTimezone(weekEndString, settings.timezone);
  
  await ScheduledPost.deleteMany({
    userId,
    status: 'scheduled',
    isAutoGenerated: true,
    scheduledAt: {
      $gte: weekStartUtc,
      $lt: weekEndUtc,
    },
  });
  
  // Generate posts for each day
  const postsToCreate: Record<string, unknown>[] = [];
  const templateUsageUpdates: Map<string, number> = new Map();
  const usedTemplatesPerEntityDay: Map<string, Set<string>> = new Map();
  const contentSelector = new BatchContentSelector();
  
  let totalSkippedPastSlots = 0;
  let totalSkippedExpiredEntities = 0;
  
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const currentDate = addDays(weekStartParsed, dayOffset);
    const currentDateString = format(currentDate, 'yyyy-MM-dd');
    const dayName = format(currentDate, 'EEEE').toLowerCase();
    
    // Skip days that are in the past (before today in user's timezone)
    // Compare date strings directly (YYYY-MM-DD format sorts correctly)
    if (currentDateString < todayString) {
      continue;
    }
    
    // Get day settings
    const daySettings = settings.weeklySchedule.find(d => d.day === dayName);
    if (!daySettings?.isActive) continue;
    
    // Get active time slots for this day
    const activeSlots = daySettings.timeSlots.filter(s => s.isActive);
    if (activeSlots.length === 0) continue;
    
    // Filter entities valid for this day AND recalculate priority for THIS date
    const validEntities: EntityPriority[] = [];
    
    for (const entity of entities) {
      // Skip if deadline is before this schedule date
      if (isEntityExpiredForDateString(entity, currentDateString, settings.timezone)) {
        totalSkippedExpiredEntities++;
        continue;
      }
      
      // Calculate priority based on THIS day (not today)
      const priority = calculatePriorityForDate(entity, currentDate, settings);
      validEntities.push(priority);
    }
    
    if (validEntities.length === 0) {
      continue; // All entities expired for this day
    }
    
    // Reset content selector for new day (same-day exclusions reset)
    contentSelector.resetForNewDay();
    
    // Allocate slots using the ratio-based algorithm
    // Pass the date string (YYYY-MM-DD) to ensure proper timezone handling
    const allocationResult = allocateSlots(
      validEntities,
      activeSlots,
      currentDateString,
      settings.timezone
    );
    
    for (const allocation of allocationResult.allocations) {
      // Skip time slots that are already in the past
      if (isBefore(allocation.scheduledTime, new Date())) {
        totalSkippedPastSlots++;
        continue;
      }
      
      // Double-check entity deadline for this specific time slot
      if (isEntityExpiredForDate(allocation.entity.entity, allocation.scheduledTime, settings.timezone)) {
        totalSkippedExpiredEntities++;
        continue;
      }
      
      const entityId = allocation.entity.entity._id.toString();
      
      // Map entity priority to template priority
      const templatePriority = mapEntityPriorityToTemplatePriority(allocation.entity.priorityLevel as EntityPriorityLevel);
      
      // Get the exclude list for this entity on this day
      const entityDayKey = getEntityDayKey(entityId, currentDateString);
      const usedTemplateIds = usedTemplatesPerEntityDay.get(entityDayKey) || new Set<string>();
      
      // Find best matching template
      const templateMatch = findBestMatchingTemplate(
        templates,
        templatePriority,
        Array.from(usedTemplateIds)
      );
      
      // Generate message
      let message: string;
      let usedTemplateId: string | undefined;
      let usedTemplateName: string | undefined;
      
      if (templateMatch) {
        message = applyTemplate(templateMatch.template.template, allocation.entity.entity);
        usedTemplateId = templateMatch.templateId;
        usedTemplateName = templateMatch.templateName;
        
        // Add to used templates for this entity on this day
        usedTemplateIds.add(usedTemplateId);
        usedTemplatesPerEntityDay.set(entityDayKey, usedTemplateIds);
        
        // Track template usage for batch update
        const currentCount = templateUsageUpdates.get(usedTemplateId) || 0;
        templateUsageUpdates.set(usedTemplateId, currentCount + 1);
      } else {
        message = generateDefaultMessage(allocation.entity.entity);
        usedTemplateName = 'Default Message (No Templates)';
      }
      
      // Select content
      const contentResult = await contentSelector.selectForPost(
        entityId,
        message,
        currentDate
      );
      
      // Determine content type for the post
      let finalContentType: string = 'text';
      let contentId: string | undefined;
      let mediaUrl: string | undefined;
      
      if (contentResult.contentId && contentResult.contentType && contentResult.fileUrl) {
        finalContentType = contentResult.contentType;
        contentId = contentResult.contentId;
        mediaUrl = contentResult.fileUrl;
      } else if (hasYouTubePlaceholder(message)) {
        finalContentType = 'youtube';
      }
      
      postsToCreate.push({
        userId,
        entityId,
        contentType: finalContentType,
        contentId,
        mediaUrl,
        message,
        templateId: usedTemplateId,
        templateName: usedTemplateName,
        scheduledAt: allocation.scheduledTime,
        scheduledDay: dayName,
        timeSlotId: allocation.slotId,
        status: 'scheduled',
        priority: allocation.entity.score,
        isAutoGenerated: true,
      });
    }
  }
  
  // EDGE CASE: Check if no posts were created
  if (postsToCreate.length === 0) {
    if (totalSkippedPastSlots > 0) {
      return {
        success: false,
        postsCreated: 0,
        message: 'All time slots for this week have already passed.',
        details: { skippedPastSlots: totalSkippedPastSlots },
      };
    }
    return {
      success: false,
      postsCreated: 0,
      message: 'No posts could be scheduled. Check your time slot and entity configurations.',
    };
  }
  
  // Bulk insert posts
  await ScheduledPost.insertMany(postsToCreate);
  
  // Update template usage counts
  for (const [templateId, usageCount] of templateUsageUpdates) {
    await MessageTemplate.findByIdAndUpdate(templateId, {
      $inc: { usageCount: usageCount },
      $set: { lastUsedAt: new Date() },
    });
  }
  
  // Batch update content usage counts
  const selectedContentIds = contentSelector.getAllSelectedContentIds();
  await batchMarkContentAsUsed(selectedContentIds);
  
  return {
    success: true,
    postsCreated: postsToCreate.length,
    message: `Successfully scheduled ${postsToCreate.length} posts for the week`,
    details: {
      skippedPastSlots: totalSkippedPastSlots,
      skippedExpiredEntities: totalSkippedExpiredEntities,
    },
  };
}


function formatDateSafe(date: Date | undefined | null, formatStr: string = 'MMMM d, yyyy'): string {
  if (!date) return '';
  try {
    return format(new Date(date), formatStr);
  } catch {
    return '';
  }
}

function applyTemplate(template: string, entity: IEntityDocument): string {
  // Calculate days remaining until lead plaintiff deadline (just the number)
  let daysRemaining = '';
  if (entity.leadPlaintiffDate) {
    const days = differenceInDays(new Date(entity.leadPlaintiffDate), new Date());
    if (days >= 0) {
      daysRemaining = String(days);
    } else {
      daysRemaining = '0'; // Deadline passed
    }
  }

  return template
    // Basic Info
    .replace(/\[Company Name\]/gi, entity.companyName || '[Company Name - Not Set]')
    .replace(/\[Ticker\]/gi, entity.tickerSymbol || '[Ticker - Not Set]')
    // Dates
    .replace(/\[Lead Plaintiff Deadline\]/gi, entity.leadPlaintiffDate ? formatDateSafe(entity.leadPlaintiffDate) : '[Lead Plaintiff Deadline - Not Set]')
    .replace(/\[Days Remaining\]/gi, daysRemaining || '[Days - Not Set]')
    .replace(/\[Class Period End\]/gi, entity.classPeriodEnd ? formatDateSafe(entity.classPeriodEnd) : '[Class Period End - Not Set]')
    .replace(/\[Class Period Start\]/gi, entity.classPeriodStart ? formatDateSafe(entity.classPeriodStart) : '[Class Period Start - Not Set]')
    .replace(/\[Class Action Period - Start Date\]/gi, entity.classPeriodStart ? formatDateSafe(entity.classPeriodStart) : '[Class Period Start - Not Set]')
    .replace(/\[Class Action Period - End Date\]/gi, entity.classPeriodEnd ? formatDateSafe(entity.classPeriodEnd) : '[Class Period End - Not Set]')
    .replace(/\[Case Date\]/gi, entity.caseDate ? formatDateSafe(entity.caseDate) : '[Case Date - Not Set]')
    // Case Details
    .replace(/\[Allegations\]/gi, entity.allegations || '[Allegations - Not Set]')
    // Links
    .replace(/\[Join Link\]/gi, entity.joinLink || '[Join Link - Not Set]')
    .replace(/\[Blog Link\]/gi, entity.blogLink || '[Blog Link - Not Set]')
    .replace(/\[YouTube Link\]/gi, entity.youtubeLink || '[YouTube Link - Not Set]')
    .replace(/\[Podcast Link\]/gi, entity.podcastLink || '[Podcast Link - Not Set]')
    .replace(/\[Avatar Video\]/gi, entity.avatarVideo || '[Avatar Video - Not Set]')
    .replace(/\[AI Video\]/gi, entity.aiVideo || '[AI Video - Not Set]');
}

function generateDefaultMessage(entity: IEntityDocument): string {
  let message = `🚨 ${entity.companyName} (${entity.tickerSymbol}) Securities Class Action\n\n`;
  
  message += `Lead Plaintiff Deadline: ${formatDateSafe(entity.leadPlaintiffDate)}\n`;
  
  if (entity.classPeriodStart && entity.classPeriodEnd) {
    message += `Class Period: ${formatDateSafe(entity.classPeriodStart)} to ${formatDateSafe(entity.classPeriodEnd)}\n`;
  }
  
  if (entity.allegations) {
    message += `\n${entity.allegations}\n`;
  }
  
  message += `\nContact us to learn about your legal options.`;
  
  if (entity.joinLink) {
    message += `\n\n👉 ${entity.joinLink}`;
  }
  
  return message;
}
