import { ContentItem, IContentItemDocument, ContentItemType } from '@/lib/db/models/ContentItem';
import { ScheduledPost } from '@/lib/db/models/ScheduledPost';
import { startOfDay, endOfDay } from 'date-fns';

/**
 * YouTube placeholder patterns to detect in template text.
 * When ANY of these are found, no content should be attached.
 */
const YOUTUBE_PLACEHOLDERS = [
  /\[Avatar Video\]/i,
  /\[AI Video\]/i,
  /\[YouTube Link\]/i,
];

/**
 * Check if template text contains YouTube placeholders.
 * When present, WhatsApp will auto-preview the YouTube link,
 * so we should NOT attach any image/video content.
 */
export function hasYouTubePlaceholder(templateText: string): boolean {
  return YOUTUBE_PLACEHOLDERS.some(pattern => pattern.test(templateText));
}

export interface ContentSelectionOptions {
  entityId: string;
  templateText: string;
  scheduledDate: Date;
  /** Content IDs to exclude (already used same day for this entity) */
  excludeContentIds?: string[];
  /** The content type of the last post for this entity (for type rotation) */
  lastContentType?: ContentItemType | null;
}

export interface ContentSelectionResult {
  contentId: string | null;
  contentType: ContentItemType | null;
  fileUrl: string | null;
  /** Reason why content was/wasn't selected */
  reason: string;
}

/**
 * Select the best content item for a scheduled post.
 * 
 * Rules applied in order:
 * 1. If template has YouTube placeholder, return null (no content)
 * 2. Same-day exclusion: Don't use same content twice on same day
 * 3. Type rotation: Prefer different content type than last post
 * 4. Sort by usage: usageCount ASC, lastUsedAt ASC (null = oldest), createdAt ASC
 */
export async function selectContent(
  options: ContentSelectionOptions
): Promise<ContentSelectionResult> {
  const { entityId, templateText, scheduledDate, excludeContentIds = [], lastContentType } = options;

  // PART 1: Check for YouTube placeholders
  if (hasYouTubePlaceholder(templateText)) {
    return {
      contentId: null,
      contentType: null,
      fileUrl: null,
      reason: 'Template contains YouTube placeholder - WhatsApp will auto-preview',
    };
  }

  // Get all active content for this entity
  const allContent = await ContentItem.find({
    entityId,
    isActive: true,
  }).lean() as IContentItemDocument[];

  // No content available - text-only post
  if (allContent.length === 0) {
    return {
      contentId: null,
      contentType: null,
      fileUrl: null,
      reason: 'No content available for entity - text-only post',
    };
  }

  // RULE 1: Same-day exclusion
  let availableContent = allContent.filter(
    content => !excludeContentIds.includes(content._id.toString())
  );

  // If ALL content excluded, reset and allow reuse
  if (availableContent.length === 0) {
    availableContent = [...allContent];
  }

  // RULE 2: Type rotation (only if entity has both images AND videos)
  const hasImages = availableContent.some(c => c.contentType === 'image');
  const hasVideos = availableContent.some(c => c.contentType === 'video');
  const hasBothTypes = hasImages && hasVideos;

  let preferredType: ContentItemType | null = null;
  if (hasBothTypes && lastContentType) {
    // Prefer opposite type
    preferredType = lastContentType === 'image' ? 'video' : 'image';
    
    // Filter to preferred type if available
    const preferredContent = availableContent.filter(c => c.contentType === preferredType);
    if (preferredContent.length > 0) {
      availableContent = preferredContent;
    }
    // If no preferred type available, use what's available (skip rotation rule)
  }

  // RULE 3: Sort by usage with tiebreakers
  availableContent.sort((a, b) => {
    // 1. usageCount - ascending (lowest first)
    if (a.usageCount !== b.usageCount) {
      return a.usageCount - b.usageCount;
    }

    // 2. lastUsedAt - ascending (oldest first, null = oldest)
    const aLastUsed = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
    const bLastUsed = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
    if (aLastUsed !== bLastUsed) {
      return aLastUsed - bLastUsed;
    }

    // 3. createdAt - ascending (oldest first)
    const aCreated = new Date(a.createdAt).getTime();
    const bCreated = new Date(b.createdAt).getTime();
    return aCreated - bCreated;
  });

  // Pick the first item after sorting
  const selected = availableContent[0];

  return {
    contentId: selected._id.toString(),
    contentType: selected.contentType,
    fileUrl: selected.fileUrl,
    reason: preferredType
      ? `Selected ${selected.contentType} (type rotation from ${lastContentType})`
      : `Selected ${selected.contentType} (least used)`,
  };
}

/**
 * Update content item usage after it's been selected for a post.
 * Increments usageCount and sets lastUsedAt.
 */
export async function markContentAsUsed(contentId: string): Promise<void> {
  await ContentItem.findByIdAndUpdate(contentId, {
    $inc: { usageCount: 1 },
    $set: { lastUsedAt: new Date() },
  });
}

/**
 * Get content IDs already used for this entity on the specified day.
 * Used for same-day exclusion rule.
 */
export async function getUsedContentIdsForEntityOnDay(
  entityId: string,
  date: Date
): Promise<string[]> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const posts = await ScheduledPost.find({
    entityId,
    scheduledAt: { $gte: dayStart, $lte: dayEnd },
    status: { $in: ['scheduled', 'processing', 'sent'] },
    contentId: { $exists: true, $ne: null },
  }).lean();

  return posts
    .map(p => (p as { contentId?: string }).contentId)
    .filter((id): id is string => id !== undefined && id !== null);
}

/**
 * Get the content type of the last scheduled/sent post for an entity.
 * Used for type rotation rule.
 */
export async function getLastContentTypeForEntity(
  entityId: string
): Promise<ContentItemType | null> {
  const lastPost = await ScheduledPost.findOne({
    entityId,
    contentId: { $exists: true, $ne: null },
    status: { $in: ['scheduled', 'processing', 'sent'] },
  })
    .sort({ scheduledAt: -1 })
    .lean();

  if (!lastPost || !lastPost.contentType) {
    return null;
  }

  // Only return image/video types for rotation
  if (lastPost.contentType === 'image' || lastPost.contentType === 'video') {
    return lastPost.contentType;
  }

  return null;
}

/**
 * Helper class for batch content selection during auto-scheduling.
 * Tracks same-day exclusions per entity in memory.
 */
export class BatchContentSelector {
  // Key: "entityId", Value: array of content IDs used today
  private usedContentPerEntity: Map<string, string[]> = new Map();
  // Key: "entityId", Value: last content type selected
  private lastTypePerEntity: Map<string, ContentItemType | null> = new Map();

  /**
   * Select content for a post in a batch operation.
   * Maintains in-memory tracking of same-day exclusions.
   */
  async selectForPost(
    entityId: string,
    templateText: string,
    scheduledDate: Date
  ): Promise<ContentSelectionResult> {
    // Get exclusion list for this entity
    const excludeContentIds = this.usedContentPerEntity.get(entityId) || [];
    const lastContentType = this.lastTypePerEntity.get(entityId) || null;

    const result = await selectContent({
      entityId,
      templateText,
      scheduledDate,
      excludeContentIds,
      lastContentType,
    });

    // Track selected content for same-day exclusion
    if (result.contentId) {
      const usedIds = this.usedContentPerEntity.get(entityId) || [];
      usedIds.push(result.contentId);
      this.usedContentPerEntity.set(entityId, usedIds);
      this.lastTypePerEntity.set(entityId, result.contentType);
    }

    return result;
  }

  /**
   * Reset tracking for a new day.
   */
  resetForNewDay(): void {
    this.usedContentPerEntity.clear();
    // Keep lastTypePerEntity for cross-day type rotation
  }

  /**
   * Get all content IDs that were selected (for batch updating usage).
   */
  getAllSelectedContentIds(): string[] {
    const allIds: string[] = [];
    for (const ids of this.usedContentPerEntity.values()) {
      allIds.push(...ids);
    }
    return allIds;
  }
}

/**
 * Batch update content usage counts.
 * More efficient than updating one by one.
 */
export async function batchMarkContentAsUsed(contentIds: string[]): Promise<void> {
  if (contentIds.length === 0) return;

  // Count occurrences of each content ID
  const usageCountMap = new Map<string, number>();
  for (const id of contentIds) {
    usageCountMap.set(id, (usageCountMap.get(id) || 0) + 1);
  }

  // Update each unique content item
  const updatePromises = Array.from(usageCountMap.entries()).map(([id, count]) =>
    ContentItem.findByIdAndUpdate(id, {
      $inc: { usageCount: count },
      $set: { lastUsedAt: new Date() },
    })
  );

  await Promise.all(updatePromises);
}

