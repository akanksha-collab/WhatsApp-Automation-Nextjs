import { S3Client, PutObjectCommand, DeleteObjectCommand, ObjectCannedACL } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME!;
const AWS_REGION = process.env.AWS_REGION!;

// Default ACL for uploaded files - set to public-read for public access
const DEFAULT_ACL: ObjectCannedACL = 'public-read';

export interface UploadResult {
  fileUrl: string;
  s3Key: string;
}

/**
 * Upload a file to S3
 * @param file - The file buffer to upload
 * @param fileName - Original file name
 * @param contentType - MIME type of the file
 * @param keyPrefix - S3 key prefix (e.g., "entities/123/images")
 * @returns Object containing fileUrl and s3Key
 */
export async function uploadToS3(
  file: Buffer,
  fileName: string,
  contentType: string,
  keyPrefix: string
): Promise<UploadResult> {
  // Generate unique key
  const uniqueId = uuidv4();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const s3Key = `${keyPrefix}/${uniqueId}-${sanitizedFileName}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
    Body: file,
    ContentType: contentType,
    ACL: DEFAULT_ACL, // Make uploaded files publicly accessible
  });

  await s3Client.send(command);

  const fileUrl = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

  return {
    fileUrl,
    s3Key,
  };
}

/**
 * Delete a file from S3
 * @param s3Key - The S3 key of the object to delete
 */
export async function deleteFromS3(s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
  });

  await s3Client.send(command);
}

/**
 * Get S3 key prefix for entity content
 * @param entityId - The entity ID
 * @param contentType - "images" or "videos"
 */
export function getS3KeyPrefix(entityId: string, contentType: 'images' | 'videos'): string {
  return `entities/${entityId}/${contentType}`;
}

/**
 * Validate image file type and size
 */
export function validateImageFile(
  mimeType: string,
  size: number
): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(mimeType)) {
    return {
      valid: false,
      error: 'Invalid file type. Supported: JPG, PNG, WebP',
    };
  }

  if (size > maxSize) {
    return {
      valid: false,
      error: 'File too large. Maximum size: 10MB',
    };
  }

  return { valid: true };
}

/**
 * Validate video file type and size
 */
export function validateVideoFile(
  mimeType: string,
  size: number
): { valid: boolean; error?: string } {
  const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/mov'];
  const maxSize = 50 * 1024 * 1024; // 50MB

  if (!allowedTypes.includes(mimeType)) {
    return {
      valid: false,
      error: 'Invalid file type. Supported: MP4, MOV, WebM',
    };
  }

  if (size > maxSize) {
    return {
      valid: false,
      error: 'File too large. Maximum size: 50MB',
    };
  }

  return { valid: true };
}

