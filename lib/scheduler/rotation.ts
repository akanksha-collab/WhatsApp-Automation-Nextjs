import { IEntityDocument } from '@/lib/db/models/Entity';
import { IScheduleSettingsDocument } from '@/lib/db/models/ScheduleSettings';
import { PostHistory } from '@/lib/db/models/PostHistory';
import { ContentType } from '@/lib/db/models/ScheduledPost';
import crypto from 'crypto';

interface ContentSelection {
  contentType: ContentType;
  mediaUrl?: string;
  mediaPublicId?: string;
  link?: string;
  contentHash: string;
}

export async function selectContent(
  entity: IEntityDocument,
  settings: IScheduleSettingsDocument
): Promise<ContentSelection | null> {
  // Get recent posts for this entity to avoid repetition
  const recentPosts = await PostHistory.find({ entityId: entity._id.toString() })
    .sort({ sentAt: -1 })
    .limit(20)
    .lean();
  
  const recentHashes = new Set(recentPosts.map(p => p.contentHash));
  
  // Build weighted content pool
  const contentPool: ContentSelection[] = [];
  const weights = settings.contentRotation;
  
  // Add images
  for (const img of entity.images) {
    const hash = generateHash('image', img.url);
    if (!recentHashes.has(hash)) {
      for (let i = 0; i < weights.imageWeight; i++) {
        contentPool.push({
          contentType: 'image',
          mediaUrl: img.url,
          mediaPublicId: img.publicId,
          contentHash: hash,
        });
      }
    }
  }
  
  // Add videos
  for (const vid of entity.videos) {
    const hash = generateHash('video', vid.url);
    if (!recentHashes.has(hash)) {
      for (let i = 0; i < weights.videoWeight; i++) {
        contentPool.push({
          contentType: 'video',
          mediaUrl: vid.url,
          mediaPublicId: vid.publicId,
          contentHash: hash,
        });
      }
    }
  }
  
  // Add YouTube link
  if (entity.youtubeLink) {
    const hash = generateHash('youtube', entity.youtubeLink);
    if (!recentHashes.has(hash)) {
      for (let i = 0; i < weights.linkWeight; i++) {
        contentPool.push({
          contentType: 'youtube',
          link: entity.youtubeLink,
          contentHash: hash,
        });
      }
    }
  }
  
  // Add Podcast link
  if (entity.podcastLink) {
    const hash = generateHash('podcast', entity.podcastLink);
    if (!recentHashes.has(hash)) {
      for (let i = 0; i < weights.linkWeight; i++) {
        contentPool.push({
          contentType: 'podcast',
          link: entity.podcastLink,
          contentHash: hash,
        });
      }
    }
  }
  
  // Add Avatar Video link
  if (entity.avatarVideo) {
    const hash = generateHash('video', entity.avatarVideo);
    if (!recentHashes.has(hash)) {
      for (let i = 0; i < weights.videoWeight; i++) {
        contentPool.push({
          contentType: 'video',
          link: entity.avatarVideo,
          contentHash: hash,
        });
      }
    }
  }
  
  // Add AI Video link
  if (entity.aiVideo) {
    const hash = generateHash('video', entity.aiVideo);
    if (!recentHashes.has(hash)) {
      for (let i = 0; i < weights.videoWeight; i++) {
        contentPool.push({
          contentType: 'video',
          link: entity.aiVideo,
          contentHash: hash,
        });
      }
    }
  }
  
  // Add Blog link
  if (entity.blogLink) {
    const hash = generateHash('article', entity.blogLink);
    if (!recentHashes.has(hash)) {
      for (let i = 0; i < weights.linkWeight; i++) {
        contentPool.push({
          contentType: 'article',
          link: entity.blogLink,
          contentHash: hash,
        });
      }
    }
  }
  
  // Add Join link (with higher weight as it's the main CTA)
  if (entity.joinLink) {
    const hash = generateHash('link', entity.joinLink);
    if (!recentHashes.has(hash)) {
      for (let i = 0; i < weights.linkWeight * 2; i++) {
        contentPool.push({
          contentType: 'article',
          link: entity.joinLink,
          contentHash: hash,
        });
      }
    }
  }
  
  // Add article links
  for (const article of entity.articleLinks) {
    const hash = generateHash('article', article);
    if (!recentHashes.has(hash)) {
      for (let i = 0; i < weights.linkWeight; i++) {
        contentPool.push({
          contentType: 'article',
          link: article,
          contentHash: hash,
        });
      }
    }
  }
  
  // Add text-only option
  const textHash = generateHash('text', entity.companyName);
  if (!recentHashes.has(textHash)) {
    for (let i = 0; i < weights.textWeight; i++) {
      contentPool.push({
        contentType: 'text',
        contentHash: textHash,
      });
    }
  }
  
  // Select random content from pool
  if (contentPool.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * contentPool.length);
  return contentPool[randomIndex];
}

function generateHash(type: string, content: string): string {
  return crypto.createHash('md5').update(`${type}:${content}`).digest('hex');
}

