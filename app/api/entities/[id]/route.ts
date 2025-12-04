import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { Entity } from '@/lib/db/models/Entity';
import { getSession } from '@/lib/auth/session';

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
  const entity = await Entity.findOne({ _id: id, userId: session.user.id }).lean();

  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  return NextResponse.json(entity);
}

export async function PUT(
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

  const entity = await Entity.findOneAndUpdate(
    { _id: id, userId: session.user.id },
    { $set: body },
    { new: true }
  );

  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  return NextResponse.json(entity);
}

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
  const result = await Entity.deleteOne({ _id: id, userId: session.user.id });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

