import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { MessageTemplate } from '@/lib/db/models/MessageTemplate';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const templates = await MessageTemplate.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const body = await req.json();
  const { name, contentType, priority, template, ctaText, ctaUrl, isDefault } = body;

  if (!name || !contentType || !template) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  // If setting as default, unset other defaults of same type and priority
  if (isDefault) {
    await MessageTemplate.updateMany(
      { userId: session.user.id, contentType, priority: priority || 'medium', isDefault: true },
      { $set: { isDefault: false } }
    );
  }

  const newTemplate = await MessageTemplate.create({
    userId: session.user.id,
    name,
    contentType,
    priority: priority || 'medium',
    template,
    ctaText: ctaText || '',
    ctaUrl: ctaUrl || '',
    isDefault: isDefault || false,
    isActive: true,
    usageCount: 0,
  });

  return NextResponse.json(newTemplate, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const body = await req.json();
  const { _id, name, contentType, priority, template, ctaText, ctaUrl, isDefault } = body;

  if (!_id) {
    return NextResponse.json({ error: 'Template ID required' }, { status: 400 });
  }

  if (!name || !contentType || !template) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  // If setting as default, unset other defaults of same type and priority
  if (isDefault) {
    await MessageTemplate.updateMany(
      { 
        userId: session.user.id, 
        contentType, 
        priority: priority || 'medium', 
        isDefault: true,
        _id: { $ne: _id }
      },
      { $set: { isDefault: false } }
    );
  }

  const updatedTemplate = await MessageTemplate.findOneAndUpdate(
    { _id, userId: session.user.id },
    {
      name,
      contentType,
      priority: priority || 'medium',
      template,
      ctaText: ctaText || '',
      ctaUrl: ctaUrl || '',
      isDefault: isDefault || false,
    },
    { new: true }
  );

  if (!updatedTemplate) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json(updatedTemplate);
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Template ID required' }, { status: 400 });
  }

  const result = await MessageTemplate.deleteOne({ _id: id, userId: session.user.id });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

