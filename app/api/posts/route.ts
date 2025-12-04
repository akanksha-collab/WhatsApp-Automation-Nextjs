import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { ScheduledPost } from '@/lib/db/models/ScheduledPost';
import { Entity } from '@/lib/db/models/Entity';
import { MessageTemplate, IMessageTemplateDocument } from '@/lib/db/models/MessageTemplate';
import { getSession } from '@/lib/auth/session';
import { format, differenceInDays, startOfDay, endOfDay } from 'date-fns';
import { 
  findBestMatchingTemplate, 
  calculateEntityPriorityLevel, 
  mapEntityPriorityToTemplatePriority 
} from '@/lib/scheduler/template-matcher';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const entityId = searchParams.get('entityId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  const query: Record<string, unknown> = { userId: session.user.id };
  
  if (status) query.status = status;
  if (entityId) query.entityId = entityId;
  if (startDate || endDate) {
    query.scheduledAt = {};
    if (startDate) (query.scheduledAt as Record<string, Date>).$gte = new Date(startDate);
    if (endDate) (query.scheduledAt as Record<string, Date>).$lte = new Date(endDate);
  }

  const [posts, total] = await Promise.all([
    ScheduledPost.find(query)
      .sort({ scheduledAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ScheduledPost.countDocuments(query),
  ]);

  // Populate entity details for each post
  const entityIds = [...new Set(posts.map(p => p.entityId))];
  const entities = await Entity.find({ _id: { $in: entityIds } }).lean();
  const entityMap = new Map(entities.map(e => [e._id.toString(), e]));

  const postsWithEntity = posts.map(post => {
    const entity = entityMap.get(post.entityId);
    return {
      ...post,
      entity: entity ? {
        companyName: entity.companyName,
        tickerSymbol: entity.tickerSymbol,
        leadPlaintiffDate: entity.leadPlaintiffDate,
      } : null,
    };
  });

  return NextResponse.json({
    posts: postsWithEntity,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// Apply template placeholders with entity data
function applyTemplate(template: string, entity: Record<string, unknown>): string {
  // Calculate days remaining until lead plaintiff deadline (just the number)
  let daysRemaining = '';
  if (entity.leadPlaintiffDate) {
    const days = differenceInDays(new Date(String(entity.leadPlaintiffDate)), new Date());
    if (days >= 0) {
      daysRemaining = String(days);
    } else {
      daysRemaining = '0'; // Deadline passed
    }
  }

  return template
    // Basic Info
    .replace(/\[Company Name\]/gi, String(entity.companyName || ''))
    .replace(/\[Ticker\]/gi, String(entity.tickerSymbol || ''))
    // Dates
    .replace(/\[Lead Plaintiff Deadline\]/gi, entity.leadPlaintiffDate ? format(new Date(String(entity.leadPlaintiffDate)), 'MMMM d, yyyy') : '')
    .replace(/\[Days Remaining\]/gi, daysRemaining)
    .replace(/\[Class Period Start\]/gi, entity.classPeriodStart ? format(new Date(String(entity.classPeriodStart)), 'MMMM d, yyyy') : '')
    .replace(/\[Class Period End\]/gi, entity.classPeriodEnd ? format(new Date(String(entity.classPeriodEnd)), 'MMMM d, yyyy') : '')
    .replace(/\[Case Date\]/gi, entity.caseDate ? format(new Date(String(entity.caseDate)), 'MMMM d, yyyy') : '')
    // Case Details
    .replace(/\[Allegations\]/gi, String(entity.allegations || ''))
    // Links
    .replace(/\[Join Link\]/gi, String(entity.joinLink || ''))
    .replace(/\[Avatar Video\]/gi, String(entity.avatarVideo || ''))
    .replace(/\[AI Video\]/gi, String(entity.aiVideo || ''))
    .replace(/\[Podcast Link\]/gi, String(entity.podcastLink || ''))
    .replace(/\[Blog Link\]/gi, String(entity.blogLink || ''))
    .replace(/\[YouTube Link\]/gi, String(entity.youtubeLink || ''));
}

// Generate default message when no template is available
function generateDefaultMessage(entity: Record<string, unknown>): string {
  let message = `🚨 ${entity.companyName} (${entity.tickerSymbol}) Securities Class Action\n\n`;
  
  if (entity.leadPlaintiffDate) {
    message += `Lead Plaintiff Deadline: ${format(new Date(String(entity.leadPlaintiffDate)), 'MMMM d, yyyy')}\n`;
  }
  
  if (entity.classPeriodStart && entity.classPeriodEnd) {
    message += `Class Period: ${format(new Date(String(entity.classPeriodStart)), 'MMMM d, yyyy')} to ${format(new Date(String(entity.classPeriodEnd)), 'MMMM d, yyyy')}\n`;
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

/**
 * Get template IDs already used for this entity today
 */
async function getUsedTemplateIdsForEntityToday(
  userId: string, 
  entityId: string, 
  scheduledDate: Date
): Promise<string[]> {
  const dayStart = startOfDay(scheduledDate);
  const dayEnd = endOfDay(scheduledDate);
  
  const existingPosts = await ScheduledPost.find({
    userId,
    entityId,
    scheduledAt: { $gte: dayStart, $lte: dayEnd },
    status: { $in: ['scheduled', 'processing', 'sent'] },
    templateId: { $exists: true, $ne: null },
  }).lean();
  
  return existingPosts
    .map(p => p.templateId)
    .filter((id): id is string => id !== undefined && id !== null);
}

// Create a manual scheduled post
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const body = await req.json();
  const { 
    entityId, 
    templateId, 
    scheduledAt, 
    contentType,
    customMessage,
    mediaUrl,
    link,
  } = body;

  if (!entityId || !scheduledAt) {
    return NextResponse.json(
      { error: 'Entity ID and scheduled time are required' },
      { status: 400 }
    );
  }

  // Get entity data
  const entity = await Entity.findOne({ _id: entityId, userId: session.user.id }).lean();
  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  const scheduledDate = new Date(scheduledAt);
  
  let message = customMessage || '';
  let finalContentType = contentType || 'text';
  const finalMediaUrl = mediaUrl;
  const finalLink = link;
  let usedTemplateId: string | undefined;
  let usedTemplateName: string | undefined;

  // Calculate entity priority based on days until deadline
  const daysUntilDeadline = differenceInDays(new Date(entity.leadPlaintiffDate), new Date());
  const entityPriorityLevel = calculateEntityPriorityLevel(daysUntilDeadline);
  const templatePriority = mapEntityPriorityToTemplatePriority(entityPriorityLevel);

  // Get all templates for this user
  const allTemplates = await MessageTemplate.find({ 
    userId: session.user.id, 
    isActive: true 
  }).lean() as IMessageTemplateDocument[];

  // If specific template is provided, use it (no exclude list for explicit selection)
  if (templateId) {
    const template = allTemplates.find(t => t._id.toString() === templateId);
    
    if (template) {
      message = applyTemplate(template.template, entity as unknown as Record<string, unknown>);
      finalContentType = template.contentType;
      usedTemplateId = template._id.toString();
      usedTemplateName = template.name;
      
      // Increment template usage count
      await MessageTemplate.findByIdAndUpdate(templateId, {
        $inc: { usageCount: 1 },
        $set: { lastUsedAt: new Date() },
      });
    }
  }

  // If no template was used yet (no templateId or template not found), auto-select best match
  if (!usedTemplateId && !message) {
    // Get templates already used for this entity today as exclude list
    const excludeTemplateIds = await getUsedTemplateIdsForEntityToday(
      session.user.id,
      entityId,
      scheduledDate
    );
    
    // Find best matching template (matches by priority only, uses exclude list)
    const bestMatch = findBestMatchingTemplate(
      allTemplates,
      templatePriority,
      excludeTemplateIds
    );
    
    if (bestMatch) {
      message = applyTemplate(bestMatch.template.template, entity as unknown as Record<string, unknown>);
      finalContentType = bestMatch.template.contentType;
      usedTemplateId = bestMatch.templateId;
      usedTemplateName = bestMatch.templateName;
      
      // Increment template usage count
      await MessageTemplate.findByIdAndUpdate(bestMatch.templateId, {
        $inc: { usageCount: 1 },
        $set: { lastUsedAt: new Date() },
      });
    }
  }

  // If still no message (no templates available), generate default
  if (!message) {
    message = generateDefaultMessage(entity as unknown as Record<string, unknown>);
    usedTemplateName = 'Default Message (No Templates)';
  }
  
  const post = await ScheduledPost.create({
    userId: session.user.id,
    entityId,
    contentType: finalContentType,
    mediaUrl: finalMediaUrl,
    message,
    link: finalLink,
    templateId: usedTemplateId,
    templateName: usedTemplateName,
    scheduledAt: scheduledDate,
    scheduledDay: format(scheduledDate, 'EEEE').toLowerCase(),
    timeSlotId: 'manual',
    status: 'scheduled',
    priority: 0,
    isAutoGenerated: false,
  });

  return NextResponse.json(post, { status: 201 });
}
