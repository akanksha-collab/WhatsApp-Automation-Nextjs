import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAppSettings {
  key: string;
  value: string;
  updatedAt: Date;
  createdAt: Date;
}

export interface IAppSettingsDocument extends IAppSettings, Document {}

const AppSettingsSchema = new Schema<IAppSettingsDocument>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: String, default: '' },
  },
  { timestamps: true }
);

export const AppSettings: Model<IAppSettingsDocument> =
  mongoose.models.AppSettings || mongoose.model<IAppSettingsDocument>('AppSettings', AppSettingsSchema);

// Settings keys as constants
export const APP_SETTINGS_KEYS = {
  IMAGE_GENERATION_GUIDELINES: 'imageGenerationGuidelines',
} as const;

