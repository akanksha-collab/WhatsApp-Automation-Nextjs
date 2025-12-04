import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMedia {
  url: string;
  publicId: string;
  type: 'image' | 'video';
  caption?: string;
  usageCount: number;
  lastUsedAt?: Date;
}

export interface IEntity {
  userId: string;
  
  // Basic Info
  companyName: string;
  tickerSymbol: string;
  
  // Important Dates
  leadPlaintiffDate: Date;
  classPeriodStart?: Date;
  classPeriodEnd?: Date;
  caseDate?: Date;
  
  // Case Details
  allegations?: string;
  
  // Links
  joinLink?: string;
  avatarVideo?: string;
  aiVideo?: string;
  podcastLink?: string;
  blogLink?: string;
  youtubeLink?: string;
  articleLinks: string[];
  
  // Media collections
  images: IMedia[];
  videos: IMedia[];
  
  // Scheduling preferences
  isActive: boolean;
  priority: number;
  lastPostedAt?: Date;
  totalPostCount: number;
  
  // Status
  status: 'active' | 'completed' | 'paused';
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IEntityDocument extends IEntity, Document {}

const MediaSchema = new Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  type: { type: String, enum: ['image', 'video'], required: true },
  caption: { type: String },
  usageCount: { type: Number, default: 0 },
  lastUsedAt: { type: Date },
});

const EntitySchema = new Schema<IEntityDocument>(
  {
    userId: { type: String, required: true, index: true },
    
    // Basic Info
    companyName: { type: String, required: true },
    tickerSymbol: { type: String, required: true, uppercase: true },
    
    // Important Dates
    leadPlaintiffDate: { type: Date, required: true, index: true },
    classPeriodStart: { type: Date },
    classPeriodEnd: { type: Date },
    caseDate: { type: Date },
    
    // Case Details
    allegations: { type: String },
    
    // Links
    joinLink: { type: String },
    avatarVideo: { type: String },
    aiVideo: { type: String },
    podcastLink: { type: String },
    blogLink: { type: String },
    youtubeLink: { type: String },
    articleLinks: [{ type: String }],
    
    // Media collections
    images: [MediaSchema],
    videos: [MediaSchema],
    
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    lastPostedAt: { type: Date },
    totalPostCount: { type: Number, default: 0 },
    
    status: { 
      type: String, 
      enum: ['active', 'completed', 'paused'],
      default: 'active'
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
EntitySchema.index({ userId: 1, status: 1 });
EntitySchema.index({ userId: 1, leadPlaintiffDate: 1 });
EntitySchema.index({ userId: 1, priority: -1 });

export const Entity: Model<IEntityDocument> =
  mongoose.models.Entity || mongoose.model<IEntityDocument>('Entity', EntitySchema);
