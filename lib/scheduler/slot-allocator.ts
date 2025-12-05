import { EntityPriority, PriorityLevel } from './priority';
import { fromZonedTime } from 'date-fns-tz';
import { setHours, setMinutes } from 'date-fns';

/**
 * Priority ratios for slot allocation.
 * These percentages determine how posts are distributed among priority levels.
 */
export const PRIORITY_RATIOS: Record<PriorityLevel, number> = {
  critical: 0.40, // 40% of total slots
  high: 0.30,     // 30% of total slots
  medium: 0.20,   // 20% of total slots
  low: 0.10,      // 10% of total slots
};

/**
 * Priority order for redistribution (highest priority first)
 */
const REDISTRIBUTION_ORDER: PriorityLevel[] = ['critical', 'high', 'medium', 'low'];

export interface SlotAllocation {
  slotId: string;
  scheduledTime: Date;
  entity: EntityPriority;
}

export interface AllocationResult {
  allocations: SlotAllocation[];
  unfilledSlots: number;
  debugInfo: {
    totalSlots: number;
    slotsPerPriority: Record<PriorityLevel, number>;
    entitiesPerPriority: Record<PriorityLevel, number>;
    postsPerEntity: Map<string, number>;
  };
}

/**
 * Group entities by their priority level
 */
export function groupEntitiesByPriority(
  entities: EntityPriority[]
): Map<PriorityLevel, EntityPriority[]> {
  const groups = new Map<PriorityLevel, EntityPriority[]>();
  
  for (const level of REDISTRIBUTION_ORDER) {
    groups.set(level, []);
  }
  
  for (const entity of entities) {
    const group = groups.get(entity.priorityLevel) || [];
    group.push(entity);
    groups.set(entity.priorityLevel, group);
  }
  
  // Sort entities within each priority by deadline (sooner first)
  for (const [level, group] of groups) {
    group.sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline);
    groups.set(level, group);
  }
  
  return groups;
}

/**
 * Calculate initial slot counts per priority level based on ratios.
 * Ensures total equals totalSlots by adjusting the largest group.
 */
export function calculateInitialSlotCounts(
  totalSlots: number
): Record<PriorityLevel, number> {
  const counts: Record<PriorityLevel, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  
  // Calculate initial slots using floor for each
  let allocated = 0;
  for (const level of REDISTRIBUTION_ORDER) {
    counts[level] = Math.floor(totalSlots * PRIORITY_RATIOS[level]);
    allocated += counts[level];
  }
  
  // Distribute remaining slots to highest priority first
  let remaining = totalSlots - allocated;
  for (const level of REDISTRIBUTION_ORDER) {
    if (remaining <= 0) break;
    counts[level]++;
    remaining--;
  }
  
  return counts;
}

/**
 * Redistribute slots from empty priority levels to non-empty ones.
 * Follows the order: Critical → High → Medium → Low
 */
export function redistributeSlots(
  slotCounts: Record<PriorityLevel, number>,
  entityGroups: Map<PriorityLevel, EntityPriority[]>
): Record<PriorityLevel, number> {
  const result = { ...slotCounts };
  
  // Find which priorities have entities
  const nonEmptyPriorities: PriorityLevel[] = REDISTRIBUTION_ORDER.filter(
    level => (entityGroups.get(level) || []).length > 0
  );
  
  // If no entities at all, return as-is (will result in no posts)
  if (nonEmptyPriorities.length === 0) {
    return result;
  }
  
  // Redistribute from empty to non-empty
  for (const level of REDISTRIBUTION_ORDER) {
    const entities = entityGroups.get(level) || [];
    
    if (entities.length === 0 && result[level] > 0) {
      // This priority has slots but no entities - redistribute
      const slotsToRedistribute = result[level];
      result[level] = 0;
      
      // Distribute to non-empty priorities in order
      let remainingSlots = slotsToRedistribute;
      let index = 0;
      
      while (remainingSlots > 0) {
        const targetLevel = nonEmptyPriorities[index % nonEmptyPriorities.length];
        result[targetLevel]++;
        remainingSlots--;
        index++;
      }
    }
  }
  
  return result;
}

/**
 * Distribute posts among entities within a priority level.
 * - Split equally among entities
 * - Extra posts go to entities with sooner deadlines
 */
export function distributeWithinPriority(
  entities: EntityPriority[],
  totalPosts: number
): Map<string, number> {
  const distribution = new Map<string, number>();
  
  if (entities.length === 0 || totalPosts === 0) {
    return distribution;
  }
  
  // Sort by deadline (sooner first) - already sorted in groupEntitiesByPriority
  const basePosts = Math.floor(totalPosts / entities.length);
  let extraPosts = totalPosts % entities.length;
  
  for (const entity of entities) {
    const entityId = entity.entity._id.toString();
    let posts = basePosts;
    
    // Entities with sooner deadlines get extra posts first
    if (extraPosts > 0) {
      posts++;
      extraPosts--;
    }
    
    if (posts > 0) {
      distribution.set(entityId, (distribution.get(entityId) || 0) + posts);
    }
  }
  
  return distribution;
}

/**
 * Main allocation function: Allocate time slots to entities based on priority ratios.
 * 
 * Algorithm:
 * 1. Group entities by priority level
 * 2. Calculate slots per priority based on ratios
 * 3. Redistribute slots from empty priorities
 * 4. Distribute within each priority (equal, extra to sooner deadlines)
 * 5. Assign actual time slots to entities
 */
export function allocateSlots(
  entities: EntityPriority[],
  slots: { id: string; time: string }[],
  date: Date,
  timezone: string
): AllocationResult {
  const allocations: SlotAllocation[] = [];
  const totalSlots = slots.length;
  
  // Edge case: no slots or no entities
  if (totalSlots === 0 || entities.length === 0) {
    return {
      allocations: [],
      unfilledSlots: totalSlots,
      debugInfo: {
        totalSlots,
        slotsPerPriority: { critical: 0, high: 0, medium: 0, low: 0 },
        entitiesPerPriority: { critical: 0, high: 0, medium: 0, low: 0 },
        postsPerEntity: new Map(),
      },
    };
  }
  
  // Step 1: Group entities by priority
  const entityGroups = groupEntitiesByPriority(entities);
  
  // Step 2: Calculate initial slot counts
  let slotCounts = calculateInitialSlotCounts(totalSlots);
  
  // Step 3: Redistribute from empty priorities
  slotCounts = redistributeSlots(slotCounts, entityGroups);
  
  // Step 4: Distribute within each priority
  const postsPerEntity = new Map<string, number>();
  
  for (const level of REDISTRIBUTION_ORDER) {
    const levelEntities = entityGroups.get(level) || [];
    const levelSlots = slotCounts[level];
    
    if (levelEntities.length > 0 && levelSlots > 0) {
      const distribution = distributeWithinPriority(levelEntities, levelSlots);
      
      for (const [entityId, count] of distribution) {
        postsPerEntity.set(entityId, (postsPerEntity.get(entityId) || 0) + count);
      }
    }
  }
  
  // Step 5: Assign time slots to entities
  // Create entity-to-priority map for quick lookup
  const entityMap = new Map<string, EntityPriority>();
  for (const entity of entities) {
    entityMap.set(entity.entity._id.toString(), entity);
  }
  
  // Build the allocation queue: each entity repeated by their post count
  const allocationQueue: EntityPriority[] = [];
  
  // Add entities in priority order (Critical first, then High, etc.)
  for (const level of REDISTRIBUTION_ORDER) {
    const levelEntities = entityGroups.get(level) || [];
    
    for (const entity of levelEntities) {
      const entityId = entity.entity._id.toString();
      const postCount = postsPerEntity.get(entityId) || 0;
      
      for (let i = 0; i < postCount; i++) {
        allocationQueue.push(entity);
      }
    }
  }
  
  // Assign slots to queue
  for (let i = 0; i < slots.length && i < allocationQueue.length; i++) {
    const slot = slots[i];
    const entity = allocationQueue[i];
    
    const [hours, minutes] = slot.time.split(':').map(Number);
    const localTime = setHours(setMinutes(date, minutes), hours);
    const scheduledTime = fromZonedTime(localTime, timezone);
    
    allocations.push({
      slotId: slot.id,
      scheduledTime,
      entity,
    });
  }
  
  // Build debug info
  const entitiesPerPriority: Record<PriorityLevel, number> = {
    critical: (entityGroups.get('critical') || []).length,
    high: (entityGroups.get('high') || []).length,
    medium: (entityGroups.get('medium') || []).length,
    low: (entityGroups.get('low') || []).length,
  };
  
  return {
    allocations,
    unfilledSlots: totalSlots - allocations.length,
    debugInfo: {
      totalSlots,
      slotsPerPriority: slotCounts,
      entitiesPerPriority,
      postsPerEntity,
    },
  };
}

/**
 * Helper: Get entities for a specific priority level
 */
export function getEntitiesForPriority(
  entityGroups: Map<PriorityLevel, EntityPriority[]>,
  priority: PriorityLevel
): EntityPriority[] {
  return entityGroups.get(priority) || [];
}

