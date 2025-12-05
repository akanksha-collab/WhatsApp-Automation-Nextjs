import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITimeSlot {
  id: string;
  time: string;
  isActive: boolean;
  label?: string;
}

export interface IDaySettings {
  day: string;
  isActive: boolean;
  timeSlots: ITimeSlot[];
}

export interface IScheduleSettings {
  userId: string;
  
  // WhatsApp Channel Info
  whatsappChannelId: string;
  maytapiProductId: string;
  maytapiPhoneId: string;
  
  // Weekly schedule
  weeklySchedule: IDaySettings[];
  
  // Priority settings
  priorityThresholds: {
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
  };
  
  // Content rotation settings
  contentRotation: {
    imageWeight: number;
    videoWeight: number;
    textWeight: number;
    linkWeight: number;
  };
  
  // Auto-scheduling
  autoScheduleEnabled: boolean;
  autoScheduleDaysBefore: number;
  
  timezone: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IScheduleSettingsDocument extends IScheduleSettings, Document {}

const TimeSlotSchema = new Schema({
  id: { type: String, required: true },
  time: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  label: { type: String },
});

const DaySettingsSchema = new Schema({
  day: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  timeSlots: [TimeSlotSchema],
});

const ScheduleSettingsSchema = new Schema<IScheduleSettingsDocument>(
  {
    userId: { type: String, required: true, unique: true },
    
    whatsappChannelId: { type: String, required: true },
    maytapiProductId: { type: String, required: true },
    maytapiPhoneId: { type: String, required: true },
    
    weeklySchedule: [DaySettingsSchema],
    
    priorityThresholds: {
      highPriority: { type: Number, default: 7 },
      mediumPriority: { type: Number, default: 14 },
      lowPriority: { type: Number, default: 30 },
    },
    
    contentRotation: {
      imageWeight: { type: Number, default: 40 },
      videoWeight: { type: Number, default: 30 },
      textWeight: { type: Number, default: 20 },
      linkWeight: { type: Number, default: 10 },
    },
    
    autoScheduleEnabled: { type: Boolean, default: true },
    autoScheduleDaysBefore: { type: Number, default: 7 },
    
    timezone: { type: String, default: 'America/New_York' },
  },
  { timestamps: true }
);

export const ScheduleSettings: Model<IScheduleSettingsDocument> =
  mongoose.models.ScheduleSettings || 
  mongoose.model<IScheduleSettingsDocument>('ScheduleSettings', ScheduleSettingsSchema);

