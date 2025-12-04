// Application constants

export const APP_NAME = 'WhatsApp Automation';
export const APP_DESCRIPTION = 'Schedule & Manage Posts';

export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export const DEFAULT_TIME_SLOTS = [
  { id: 'slot-1', time: '09:00', label: 'Morning' },
  { id: 'slot-2', time: '12:00', label: 'Noon' },
  { id: 'slot-3', time: '15:00', label: 'Afternoon' },
  { id: 'slot-4', time: '18:00', label: 'Evening' },
];

export const PRIORITY_THRESHOLDS = {
  critical: 7,
  high: 14,
  medium: 30,
};

export const FREQUENCY_MULTIPLIERS = {
  critical: 3,
  high: 2,
  medium: 1.5,
  low: 1,
};

export const CONTENT_WEIGHTS = {
  image: 40,
  video: 30,
  text: 20,
  link: 10,
};

export const CONTENT_TYPES = [
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'text', label: 'Text' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'article', label: 'Article' },
] as const;

export const POST_STATUSES = [
  { value: 'scheduled', label: 'Scheduled', color: 'green' },
  { value: 'processing', label: 'Processing', color: 'amber' },
  { value: 'sent', label: 'Sent', color: 'blue' },
  { value: 'failed', label: 'Failed', color: 'red' },
  { value: 'cancelled', label: 'Cancelled', color: 'gray' },
] as const;

export const ENTITY_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
] as const;

export const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'UTC', label: 'UTC' },
];

export const TEMPLATE_PLACEHOLDERS = [
  { tag: '{{companyName}}', description: 'Company name' },
  { tag: '{{tickerSymbol}}', description: 'Stock ticker symbol' },
  { tag: '{{leadPlaintiffDate}}', description: 'Lead plaintiff deadline date' },
  { tag: '{{caseDate}}', description: 'Case filing date' },
];

