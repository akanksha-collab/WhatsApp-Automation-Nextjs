import { IEntityDocument } from '@/lib/db/models/Entity';
import { IScheduleSettingsDocument } from '@/lib/db/models/ScheduleSettings';
import { differenceInDays, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// All calculations use America/New_York timezone
const NY_TIMEZONE = 'America/New_York';

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface EntityPriority {
  entity: IEntityDocument;
  priorityLevel: PriorityLevel;
  daysUntilDeadline: number;
  frequencyMultiplier: number;
  score: number;
}

export function calculatePriority(
  entity: IEntityDocument,
  settings: IScheduleSettingsDocument
): EntityPriority {
  // Calculate days using America/New_York timezone
  const deadlineInNY = startOfDay(toZonedTime(new Date(entity.leadPlaintiffDate), NY_TIMEZONE));
  const todayInNY = startOfDay(toZonedTime(new Date(), NY_TIMEZONE));
  const daysUntil = differenceInDays(deadlineInNY, todayInNY);
  
  let priorityLevel: PriorityLevel;
  let frequencyMultiplier: number;
  
  if (daysUntil < 0) {
    // Past deadline - completed
    priorityLevel = 'low';
    frequencyMultiplier = settings.frequencyMultipliers.low;
  } else if (daysUntil <= settings.priorityThresholds.highPriority) {
    // Includes daysUntil === 0 (due today) as critical
    priorityLevel = 'critical';
    frequencyMultiplier = settings.frequencyMultipliers.critical;
  } else if (daysUntil <= settings.priorityThresholds.mediumPriority) {
    priorityLevel = 'high';
    frequencyMultiplier = settings.frequencyMultipliers.high;
  } else if (daysUntil <= settings.priorityThresholds.lowPriority) {
    priorityLevel = 'medium';
    frequencyMultiplier = settings.frequencyMultipliers.medium;
  } else {
    priorityLevel = 'low';
    frequencyMultiplier = settings.frequencyMultipliers.low;
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

export function sortByPriority(entities: EntityPriority[]): EntityPriority[] {
  return entities.sort((a, b) => b.score - a.score);
}
