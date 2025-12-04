import mongoose, { Schema, Document, Model } from 'mongoose';

export type TemplatePriority = 'urgent' | 'high' | 'medium' | 'low';
export type TemplateContentType = 'image' | 'video' | 'text' | 'link';

export interface IMessageTemplate {
  userId: string;
  name: string; // Template Bucket name
  contentType: TemplateContentType;
  priority: TemplatePriority;
  
  // Template with placeholders (use square brackets)
  // Available placeholders:
  // [Company Name], [Ticker], [Lead Plaintiff Deadline], [Class Period Start],
  // [Class Period End], [Case Date], [Allegations], [Join Link],
  // [Avatar Video], [AI Video], [Podcast Link], [Blog Link], [YouTube Link]
  template: string;
  
  // Call to action
  ctaText?: string;
  ctaUrl?: string;
  
  isDefault: boolean;
  isActive: boolean;
  
  // Usage tracking
  usageCount: number;
  lastUsedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessageTemplateDocument extends IMessageTemplate, Document {}

const MessageTemplateSchema = new Schema<IMessageTemplateDocument>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    contentType: { 
      type: String, 
      enum: ['image', 'video', 'text', 'link'],
      required: true 
    },
    priority: {
      type: String,
      enum: ['urgent', 'high', 'medium', 'low'],
      default: 'medium'
    },
    template: { type: String, required: true },
    ctaText: { type: String },
    ctaUrl: { type: String },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    usageCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date },
  },
  { timestamps: true }
);

MessageTemplateSchema.index({ userId: 1, contentType: 1 });
MessageTemplateSchema.index({ userId: 1, priority: 1 });

export const MessageTemplate: Model<IMessageTemplateDocument> =
  mongoose.models.MessageTemplate || 
  mongoose.model<IMessageTemplateDocument>('MessageTemplate', MessageTemplateSchema);

