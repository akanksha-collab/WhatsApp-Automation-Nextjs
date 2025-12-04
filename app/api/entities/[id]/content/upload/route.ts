import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { ContentItem } from '@/lib/db/models/ContentItem';
import { Entity } from '@/lib/db/models/Entity';
import { getSession } from '@/lib/auth/session';
import { 
  uploadToS3, 
  getS3KeyPrefix, 
  validateImageFile, 
  validateVideoFile 
} from '@/lib/s3';

// POST /api/entities/[id]/content/upload - Upload content
export async function POST(
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

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const contentType = formData.get('contentType') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!contentType || (contentType !== 'image' && contentType !== 'video')) {
      return NextResponse.json(
        { error: 'Invalid content type. Must be "image" or "video"' },
        { status: 400 }
      );
    }

    const mimeType = file.type;
    const fileSize = file.size;
    const fileName = file.name;

    // Validate file based on type
    if (contentType === 'image') {
      const validation = validateImageFile(mimeType, fileSize);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    } else {
      const validation = validateVideoFile(mimeType, fileSize);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine S3 key prefix
    const keyPrefix = getS3KeyPrefix(
      entityId,
      contentType === 'image' ? 'images' : 'videos'
    );

    // Upload to S3
    const { fileUrl, s3Key } = await uploadToS3(
      buffer,
      fileName,
      mimeType,
      keyPrefix
    );

    // For images, thumbnailUrl is the same as fileUrl
    // For videos, we'll use the same URL (could be enhanced with video thumbnail generation)
    const thumbnailUrl = fileUrl;

    // Create content item in database
    const contentItem = await ContentItem.create({
      entityId,
      contentType,
      fileName,
      fileUrl,
      s3Key,
      thumbnailUrl,
      usageCount: 0,
      isActive: true,
    });

    return NextResponse.json(contentItem, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    );
  }
}

