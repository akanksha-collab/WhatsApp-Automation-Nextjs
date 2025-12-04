// Common types used throughout the application

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: string;
  status?: number;
}

export interface ApiSuccess<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

export type ContentType = 'image' | 'video' | 'text' | 'youtube' | 'podcast' | 'article';
export type PostStatus = 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';
export type EntityStatus = 'active' | 'completed' | 'paused';
export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface EntitySummary {
  _id: string;
  companyName: string;
  tickerSymbol: string;
  leadPlaintiffDate: Date;
  status: EntityStatus;
  daysUntilDeadline: number;
  priorityLevel: PriorityLevel;
}

export interface ScheduleSlot {
  id: string;
  time: string;
  day: string;
  isActive: boolean;
}

export interface WeeklyStats {
  totalPosts: number;
  sentPosts: number;
  failedPosts: number;
  pendingPosts: number;
}

