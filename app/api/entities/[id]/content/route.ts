import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { ContentItem } from '@/lib/db/models/ContentItem';
import { Entity } from '@/lib/db/models/Entity';
import { getSession } from '@/lib/auth/session';

// GET /api/entities/[id]/content - Get all content for an entity
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const { id: entityId } = await params;

  // Verify entity belongs to user
  const entity = await Entity.findOne({ _id: entityId, userId: session.user.id });
  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const contentType = searchParams.get('contentType');

  // Build query
  const query: Record<string, unknown> = { 
    entityId,
    isActive: true,
  };

  if (contentType && (contentType === 'image' || contentType === 'video')) {
    query.contentType = contentType;
  }

  const contentItems = await ContentItem.find(query)
    .sort({ createdAt: -1 })
    .lean();

  // Separate into images and videos
  const images = contentItems.filter(item => item.contentType === 'image');
  const videos = contentItems.filter(item => item.contentType === 'video');

  return NextResponse.json({
    images,
    videos,
    totalImages: images.length,
    totalVideos: videos.length,
  });
}

