import mongoose, { Schema, Document, Model } from 'mongoose';

export type ContentItemType = 'image' | 'video';

export interface IContentItem {
  entityId: string;
  contentType: ContentItemType;
  fileName: string;
  fileUrl: string;
  s3Key: string; // S3 key for deletion
  thumbnailUrl: string;
  usageCount: number;
  lastUsedAt?: Date;
  isActive: boolean;
  // AI generation fields
  isAiGenerated: boolean;
  aiPrompt?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IContentItemDocument extends IContentItem, Document {}

const ContentItemSchema = new Schema<IContentItemDocument>(
  {
    entityId: { type: String, required: true, index: true },
    contentType: { 
      type: String, 
      enum: ['image', 'video'], 
      required: true 
    },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    s3Key: { type: String, required: true },
    thumbnailUrl: { type: String, required: true },
    usageCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date },
    isActive: { type: Boolean, default: true },
    // AI generation fields
    isAiGenerated: { type: Boolean, default: false },
    aiPrompt: { type: String },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
ContentItemSchema.index({ entityId: 1, contentType: 1, isActive: 1 });
ContentItemSchema.index({ entityId: 1, isActive: 1 });

export const ContentItem: Model<IContentItemDocument> =
  mongoose.models.ContentItem || mongoose.model<IContentItemDocument>('ContentItem', ContentItemSchema);

