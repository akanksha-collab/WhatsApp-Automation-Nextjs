import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { ContentItem } from '@/lib/db/models/ContentItem';
import { Entity } from '@/lib/db/models/Entity';
import { getSession } from '@/lib/auth/session';
import { deleteFromS3 } from '@/lib/s3';

// DELETE /api/entities/[id]/content/[contentId] - Delete content item
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; contentId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const { id: entityId, contentId } = await params;

  // Verify entity belongs to user
  const entity = await Entity.findOne({ _id: entityId, userId: session.user.id });
  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  // Find content item
  const contentItem = await ContentItem.findOne({
    _id: contentId,
    entityId,
  });

  if (!contentItem) {
    return NextResponse.json({ error: 'Content item not found' }, { status: 404 });
  }

  try {
    // Delete from S3
    await deleteFromS3(contentItem.s3Key);

    // Hard delete from database (or soft delete by setting isActive: false)
    await ContentItem.findByIdAndDelete(contentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete content' },
      { status: 500 }
    );
  }
}

// GET /api/entities/[id]/content/[contentId] - Get single content item
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; contentId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const { id: entityId, contentId } = await params;

  // Verify entity belongs to user
  const entity = await Entity.findOne({ _id: entityId, userId: session.user.id });
  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  const contentItem = await ContentItem.findOne({
    _id: contentId,
    entityId,
    isActive: true,
  }).lean();

  if (!contentItem) {
    return NextResponse.json({ error: 'Content item not found' }, { status: 404 });
  }

  return NextResponse.json(contentItem);
}

