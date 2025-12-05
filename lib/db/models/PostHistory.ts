import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPostHistory {
  userId: string;
  entityId: string;
  scheduledPostId: string;
  
  contentType: string;
  contentId?: string;        // Reference to ContentItem
  mediaUrl?: string;
  message: string;
  
  sentAt: Date;
  maytapiMessageId: string;
  
  // For preventing repetition
  contentHash: string;
  
  createdAt: Date;
}

export interface IPostHistoryDocument extends IPostHistory, Document {}

const PostHistorySchema = new Schema<IPostHistoryDocument>(
  {
    userId: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    scheduledPostId: { type: String, required: true },
    
    contentType: { type: String, required: true },
    contentId: { type: String, index: true },  // Reference to ContentItem
    mediaUrl: { type: String },
    message: { type: String, required: true },
    
    sentAt: { type: Date, required: true },
    maytapiMessageId: { type: String, required: true },
    
    contentHash: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

// Index for checking recent posts per entity
PostHistorySchema.index({ entityId: 1, sentAt: -1 });
PostHistorySchema.index({ entityId: 1, contentHash: 1 });

export const PostHistory: Model<IPostHistoryDocument> =
  mongoose.models.PostHistory || 
  mongoose.model<IPostHistoryDocument>('PostHistory', PostHistorySchema);

