import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { ScheduledPost } from '@/lib/db/models/ScheduledPost';
import { getSession } from '@/lib/auth/session';

// GET /api/posts/[id] - Get single post
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const { id } = await params;

  const post = await ScheduledPost.findOne({
    _id: id,
    userId: session.user.id,
  }).lean();

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  return NextResponse.json(post);
}

// DELETE /api/posts/[id] - Delete a scheduled post
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const { id } = await params;

  // Find the post
  const post = await ScheduledPost.findOne({
    _id: id,
    userId: session.user.id,
  });

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  // Check if post can be deleted (only scheduled posts before their scheduled time)
  const now = new Date();
  const scheduledTime = new Date(post.scheduledAt);
  
  // Allow deletion only for scheduled posts that haven't been processed yet
  if (post.status !== 'scheduled') {
    return NextResponse.json(
      { error: `Cannot delete post with status "${post.status}". Only scheduled posts can be deleted.` },
      { status: 400 }
    );
  }

  if (scheduledTime <= now) {
    return NextResponse.json(
      { error: 'Cannot delete post after its scheduled time has passed.' },
      { status: 400 }
    );
  }

  // Delete the post
  await ScheduledPost.findByIdAndDelete(id);

  return NextResponse.json({ success: true, message: 'Post deleted successfully' });
}

// PATCH /api/posts/[id] - Update post status (cancel)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const { id } = await params;
  const body = await req.json();
  const { status } = body;

  // Find the post
  const post = await ScheduledPost.findOne({
    _id: id,
    userId: session.user.id,
  });

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  // Only allow cancelling scheduled posts
  if (status === 'cancelled' && post.status !== 'scheduled') {
    return NextResponse.json(
      { error: 'Can only cancel scheduled posts' },
      { status: 400 }
    );
  }

  post.status = status;
  await post.save();

  return NextResponse.json(post);
}

