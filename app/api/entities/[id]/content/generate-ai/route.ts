import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { Entity, ContentItem } from '@/lib/db/models';
import { getSession } from '@/lib/auth/session';
import { uploadToS3, getS3KeyPrefix } from '@/lib/s3';

const NANO_BANANA_API_URL = process.env.NANO_BANANA_API_URL || 'https://api.nanobanana.com/v1/generate';
const NANO_BANANA_API_KEY = process.env.NANO_BANANA_API_KEY;

interface GenerateAIRequest {
  prompt: string;
  style?: string;
}

// POST /api/entities/[id]/content/generate-ai
// Generate an AI image using Nano Banana and save to S3
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: entityId } = await params;

  if (!NANO_BANANA_API_KEY) {
    return NextResponse.json(
      { error: 'AI image generation is not configured. Missing API key.' },
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
    const { prompt, style } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Call Nano Banana API
    const nanoBananaResponse = await fetch(NANO_BANANA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NANO_BANANA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        style: style || 'professional',
        size: '1024x1024',
      }),
    });

    if (!nanoBananaResponse.ok) {
      const errorData = await nanoBananaResponse.json().catch(() => ({}));
      console.error('Nano Banana API error:', errorData);
      return NextResponse.json(
        { error: errorData.message || 'Failed to generate image' },
        { status: 500 }
      );
    }

    const nanoBananaData = await nanoBananaResponse.json();
    
    // Get the image URL from response
    // Adjust this based on actual Nano Banana API response structure
    const imageUrl = nanoBananaData.image_url || nanoBananaData.url || nanoBananaData.data?.url;
    
    if (!imageUrl) {
      console.error('No image URL in Nano Banana response:', nanoBananaData);
      return NextResponse.json(
        { error: 'No image URL returned from AI service' },
        { status: 500 }
      );
    }

    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download generated image' },
        { status: 500 }
      );
    }

    const imageBlob = await imageResponse.blob();
    const imageBuffer = Buffer.from(await imageBlob.arrayBuffer());

    // Generate filename
    const timestamp = Date.now();
    const fileName = `ai_generated_${timestamp}.png`;

    // Upload to S3
    const keyPrefix = `${getS3KeyPrefix(entityId, 'images')}/ai`;
    const { fileUrl, s3Key } = await uploadToS3(
      imageBuffer,
      fileName,
      'image/png',
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

