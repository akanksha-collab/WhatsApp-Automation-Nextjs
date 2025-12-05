import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { Entity, ContentItem } from '@/lib/db/models';
import { getSession } from '@/lib/auth/session';
import { uploadToS3, getS3KeyPrefix } from '@/lib/s3';
import { generateImageAsBuffer } from '@/lib/gemini/client';

interface GenerateAIRequest {
  prompt: string;
  imageSize?: '256' | '512' | '1K' | '2K';
}

// POST /api/entities/[id]/content/generate-ai
// Generate an AI image using Google Gemini and save to S3
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: entityId } = await params;

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'AI image generation is not configured. Missing GEMINI_API_KEY.' },
      { status: 500 }
    );
  }

  await connectDB();

  // Verify entity exists and belongs to user
  const entity = await Entity.findOne({ _id: entityId, userId: session.user.id });
  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  try {
    const body: GenerateAIRequest = await req.json();
    const { prompt, imageSize } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Generate image using Gemini
    const result = await generateImageAsBuffer({
      prompt,
      imageSize: imageSize || '1K',
    });

    if (!result.success || !result.buffer) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate image' },
        { status: 500 }
      );
    }

    // Determine file extension based on mime type
    const mimeType = result.mimeType || 'image/png';
    const extension = mimeType.includes('jpeg') ? 'jpg' : 'png';

    // Generate filename
    const timestamp = Date.now();
    const fileName = `ai_generated_${timestamp}.${extension}`;

    // Upload to S3
    const keyPrefix = `${getS3KeyPrefix(entityId, 'images')}/ai`;
    const { fileUrl, s3Key } = await uploadToS3(
      result.buffer,
      fileName,
      mimeType,
      keyPrefix
    );

    // Create content item
    const contentItem = await ContentItem.create({
      entityId,
      contentType: 'image',
      fileName,
      fileUrl,
      s3Key,
      thumbnailUrl: fileUrl,
      usageCount: 0,
      isActive: true,
      isAiGenerated: true,
      aiPrompt: prompt,
    });

    return NextResponse.json({
      success: true,
      contentItem: {
        _id: contentItem._id.toString(),
        entityId: contentItem.entityId,
        contentType: contentItem.contentType,
        fileName: contentItem.fileName,
        fileUrl: contentItem.fileUrl,
        thumbnailUrl: contentItem.thumbnailUrl,
        usageCount: contentItem.usageCount,
        isAiGenerated: contentItem.isAiGenerated,
        aiPrompt: contentItem.aiPrompt,
        createdAt: contentItem.createdAt,
      },
    });
  } catch (error) {
    console.error('Error generating AI image:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    );
  }
}
