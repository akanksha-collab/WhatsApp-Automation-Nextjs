import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { ScheduledPost } from '@/lib/db/models/ScheduledPost';
import { Entity } from '@/lib/db/models/Entity';
import { getSession } from '@/lib/auth/session';

// GET /api/entities/[id]/history - Get post history for an entity
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
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const status = searchParams.get('status'); // Optional: filter by specific status

  // Build query - get sent, failed, and cancelled posts (history)
  const query: Record<string, unknown> = {
    entityId,
    userId: session.user.id,
  };

  if (status) {
    query.status = status;
  } else {
    // Default: show all completed posts (sent, failed, cancelled)
    query.status = { $in: ['sent', 'failed', 'cancelled'] };
  }

  const [posts, total] = await Promise.all([
    ScheduledPost.find(query)
      .sort({ sentAt: -1, scheduledAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ScheduledPost.countDocuments(query),
  ]);

  // Get counts by status
  const [sentCount, failedCount, cancelledCount] = await Promise.all([
    ScheduledPost.countDocuments({ entityId, userId: session.user.id, status: 'sent' }),
    ScheduledPost.countDocuments({ entityId, userId: session.user.id, status: 'failed' }),
    ScheduledPost.countDocuments({ entityId, userId: session.user.id, status: 'cancelled' }),
  ]);

  return NextResponse.json({
    posts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    stats: {
      sent: sentCount,
      failed: failedCount,
      cancelled: cancelledCount,
      total: sentCount + failedCount + cancelledCount,
    },
  });
}

