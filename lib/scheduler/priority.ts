import { IEntityDocument } from '@/lib/db/models/Entity';
import { IScheduleSettingsDocument } from '@/lib/db/models/ScheduleSettings';
import { differenceInDays, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// All calculations use America/New_York timezone
const NY_TIMEZONE = 'America/New_York';

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Fixed priority thresholds based on days until Lead Plaintiff Deadline:
 * - Critical: 0-7 days (40% of posts)
 * - High: 8-14 days (30% of posts)
 * - Medium: 15-30 days (20% of posts)
 * - Low: 31+ days (10% of posts)
 */
export const PRIORITY_THRESHOLDS = {
  critical: { min: 0, max: 7 },
  high: { min: 8, max: 14 },
  medium: { min: 15, max: 30 },
  low: { min: 31, max: Infinity },
};

export interface EntityPriority {
  entity: IEntityDocument;
  priorityLevel: PriorityLevel;
  daysUntilDeadline: number;
  frequencyMultiplier: number;
  score: number;
}

/**
 * Calculate priority level based on days until deadline.
 * Uses fixed thresholds regardless of user settings.
 */
export function getPriorityLevel(daysUntilDeadline: number): PriorityLevel {
  if (daysUntilDeadline < 0) {
    // Past deadline - should be filtered out, but return low as fallback
    return 'low';
  }
  
  if (daysUntilDeadline <= PRIORITY_THRESHOLDS.critical.max) {
    return 'critical';
  }
  
  if (daysUntilDeadline <= PRIORITY_THRESHOLDS.high.max) {
    return 'high';
  }
  
  if (daysUntilDeadline <= PRIORITY_THRESHOLDS.medium.max) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * Calculate priority for an entity based on days until deadline.
 * Uses fixed thresholds: 0-7 (Critical), 8-14 (High), 15-30 (Medium), 31+ (Low)
 */
export function calculatePriority(
  entity: IEntityDocument,
  settings: IScheduleSettingsDocument
): EntityPriority {
  // Calculate days using America/New_York timezone
  const deadlineInNY = startOfDay(toZonedTime(new Date(entity.leadPlaintiffDate), NY_TIMEZONE));
  const todayInNY = startOfDay(toZonedTime(new Date(), NY_TIMEZONE));
  const daysUntil = differenceInDays(deadlineInNY, todayInNY);
  
  // Use fixed priority thresholds
  const priorityLevel = getPriorityLevel(daysUntil);
  
  // Get frequency multiplier from settings (still used for scoring, not slot allocation)
  let frequencyMultiplier: number;
  switch (priorityLevel) {
    case 'critical':
      frequencyMultiplier = settings.frequencyMultipliers.critical;
      break;
    case 'high':
      frequencyMultiplier = settings.frequencyMultipliers.high;
      break;
    case 'medium':
      frequencyMultiplier = settings.frequencyMultipliers.medium;
      break;
    case 'low':
    default:
      frequencyMultiplier = settings.frequencyMultipliers.low;
      break;
  }
  
  // Calculate score (higher = more urgent)
  // Score considers: days until deadline, total post count (fewer posts = higher priority)
  const urgencyScore = daysUntil > 0 ? (100 / daysUntil) : (daysUntil === 0 ? 100 : 0);
  const postCountPenalty = entity.totalPostCount * 0.1;
  const score = (urgencyScore * frequencyMultiplier) - postCountPenalty;
  
  return {
    entity,
    priorityLevel,
    daysUntilDeadline: daysUntil,
    frequencyMultiplier,
    score: Math.max(0, score),
  };
}

/**
 * Calculate priority for a specific date (not today).
 * Used when scheduling posts for future days where deadline distance changes.
 */
export function calculatePriorityForDate(
  entity: IEntityDocument,
  targetDate: Date,
  settings: IScheduleSettingsDocument
): EntityPriority {
  // Calculate days from target date to deadline
  const deadlineInNY = startOfDay(toZonedTime(new Date(entity.leadPlaintiffDate), NY_TIMEZONE));
  const targetInNY = startOfDay(toZonedTime(targetDate, NY_TIMEZONE));
  const daysUntil = differenceInDays(deadlineInNY, targetInNY);
  
  // Use fixed priority thresholds
  const priorityLevel = getPriorityLevel(daysUntil);
  
  // Get frequency multiplier from settings
  let frequencyMultiplier: number;
  switch (priorityLevel) {
    case 'critical':
      frequencyMultiplier = settings.frequencyMultipliers.critical;
      break;
    case 'high':
      frequencyMultiplier = settings.frequencyMultipliers.high;
      break;
    case 'medium':
      frequencyMultiplier = settings.frequencyMultipliers.medium;
      break;
    case 'low':
    default:
      frequencyMultiplier = settings.frequencyMultipliers.low;
      break;
  }
  
  // Calculate score
  const urgencyScore = daysUntil > 0 ? (100 / daysUntil) : (daysUntil === 0 ? 100 : 0);
  const postCountPenalty = entity.totalPostCount * 0.1;
  const score = (urgencyScore * frequencyMultiplier) - postCountPenalty;
  
  return {
    entity,
    priorityLevel,
    daysUntilDeadline: daysUntil,
    frequencyMultiplier,
    score: Math.max(0, score),
  };
}

export function sortByPriority(entities: EntityPriority[]): EntityPriority[] {
  return entities.sort((a, b) => b.score - a.score);
}
