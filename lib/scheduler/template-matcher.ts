import { IMessageTemplateDocument, TemplatePriority } from '@/lib/db/models/MessageTemplate';

export type EntityPriorityLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Map entity priority level to template priority
 */
export function mapEntityPriorityToTemplatePriority(priorityLevel: EntityPriorityLevel): TemplatePriority {
  switch (priorityLevel) {
    case 'critical':
      return 'urgent';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'medium';
  }
}

/**
 * Calculate entity priority level based on days until deadline
 */
export function calculateEntityPriorityLevel(daysUntilDeadline: number): EntityPriorityLevel {
  if (daysUntilDeadline <= 7) return 'critical';
  if (daysUntilDeadline <= 14) return 'high';
  if (daysUntilDeadline <= 30) return 'medium';
  return 'low';
}

export interface TemplateMatch {
  template: IMessageTemplateDocument;
  templateId: string;
  templateName: string;
}

/**
 * Get adjacent priority levels for fallback
 */
function getAdjacentPriorities(priority: TemplatePriority): TemplatePriority[] {
  switch (priority) {
    case 'urgent':
      return ['high'];
    case 'high':
      return ['urgent', 'medium'];
    case 'medium':
      return ['high', 'low'];
    case 'low':
      return ['medium'];
    default:
      return [];
  }
}

/**
 * Get all priority levels except the given ones
 */
function getRemainingPriorities(excludePriorities: TemplatePriority[]): TemplatePriority[] {
  const allPriorities: TemplatePriority[] = ['urgent', 'high', 'medium', 'low'];
  return allPriorities.filter(p => !excludePriorities.includes(p));
}

/**
 * Sort templates by usageCount (ascending) and lastUsedAt (ascending) as tiebreaker
 * Least used and oldest used templates come first
 */
function sortTemplatesByUsage(templates: IMessageTemplateDocument[]): IMessageTemplateDocument[] {
  return [...templates].sort((a, b) => {
    // Primary sort: usageCount ascending (least used first)
    const usageCountA = a.usageCount || 0;
    const usageCountB = b.usageCount || 0;
    
    if (usageCountA !== usageCountB) {
      return usageCountA - usageCountB;
    }
    
    // Tiebreaker: lastUsedAt ascending (oldest first, null = never used = oldest)
    const lastUsedA = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
    const lastUsedB = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
    
    return lastUsedA - lastUsedB;
  });
}

/**
 * Filter templates by priority and exclude list
 */
function filterTemplates(
  templates: IMessageTemplateDocument[],
  priority: TemplatePriority,
  excludeIds: string[]
): IMessageTemplateDocument[] {
  return templates.filter(t => 
    t.isActive && 
    t.priority === priority && 
    !excludeIds.includes(t._id.toString())
  );
}

/**
 * Filter templates by multiple priorities and exclude list
 */
function filterTemplatesByPriorities(
  templates: IMessageTemplateDocument[],
  priorities: TemplatePriority[],
  excludeIds: string[]
): IMessageTemplateDocument[] {
  return templates.filter(t => 
    t.isActive && 
    priorities.includes(t.priority) && 
    !excludeIds.includes(t._id.toString())
  );
}

/**
 * Create a TemplateMatch result from a template
 */
function createTemplateMatch(template: IMessageTemplateDocument): TemplateMatch {
  return {
    template,
    templateId: template._id.toString(),
    templateName: template.name,
  };
}

/**
 * Find the best matching template based on priority level and usage count.
 * 
 * SIMPLIFIED MATCHING LOGIC:
 * - Match ONLY by priority level (contentType is ignored)
 * - Select the template with the LOWEST usageCount
 * - Tiebreaker: oldest lastUsedAt timestamp
 * - Support exclude list to prevent same-day repetition for same entity
 * 
 * FALLBACK STRATEGY when all templates for matching priority are excluded:
 * 1. Try adjacent priority levels
 * 2. Try any priority level
 * 3. Reset exclude list and try again
 * 
 * @param templates - Array of available templates
 * @param priority - The priority level to match (urgent, high, medium, low)
 * @param excludeTemplateIds - Array of template IDs to exclude (already used today for this entity)
 * @returns TemplateMatch or undefined if no templates available
 */
export function findBestMatchingTemplate(
  templates: IMessageTemplateDocument[],
  priority: TemplatePriority = 'medium',
  excludeTemplateIds: string[] = []
): TemplateMatch | undefined {
  if (!templates || templates.length === 0) {
    return undefined;
  }

  // Step 1: Try exact priority match
  let candidates = filterTemplates(templates, priority, excludeTemplateIds);
  
  if (candidates.length > 0) {
    const sorted = sortTemplatesByUsage(candidates);
    return createTemplateMatch(sorted[0]);
  }

  // Step 2: Fallback Level 1 - Try adjacent priorities
  const adjacentPriorities = getAdjacentPriorities(priority);
  candidates = filterTemplatesByPriorities(templates, adjacentPriorities, excludeTemplateIds);
  
  if (candidates.length > 0) {
    const sorted = sortTemplatesByUsage(candidates);
    return createTemplateMatch(sorted[0]);
  }

  // Step 3: Fallback Level 2 - Try any remaining priority
  const triedPriorities = [priority, ...adjacentPriorities];
  const remainingPriorities = getRemainingPriorities(triedPriorities);
  candidates = filterTemplatesByPriorities(templates, remainingPriorities, excludeTemplateIds);
  
  if (candidates.length > 0) {
    const sorted = sortTemplatesByUsage(candidates);
    return createTemplateMatch(sorted[0]);
  }

  // Step 4: Fallback Level 3 - Reset exclude list and try again
  // All templates across all priorities are excluded, so clear the exclude list
  if (excludeTemplateIds.length > 0) {
    // Try exact priority match without exclusions
    candidates = filterTemplates(templates, priority, []);
    
    if (candidates.length > 0) {
      const sorted = sortTemplatesByUsage(candidates);
      return createTemplateMatch(sorted[0]);
    }
    
    // Try any active template without exclusions
    const allActive = templates.filter(t => t.isActive);
    if (allActive.length > 0) {
      const sorted = sortTemplatesByUsage(allActive);
      return createTemplateMatch(sorted[0]);
    }
  }

  return undefined;
}

/**
 * Legacy function signature for backward compatibility
 * @deprecated Use findBestMatchingTemplate with priority and excludeTemplateIds instead
 */
export function findBestMatchingTemplateLegacy(
  templates: IMessageTemplateDocument[],
  _contentType: string = 'text',
  priority: TemplatePriority = 'medium'
): TemplateMatch | undefined {
  // Ignore contentType, use new logic
  return findBestMatchingTemplate(templates, priority, []);
}
