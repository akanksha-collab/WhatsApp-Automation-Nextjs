import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { ScheduleSettings } from '@/lib/db/models/ScheduleSettings';
import { getSession } from '@/lib/auth/session';

const DEFAULT_WEEKLY_SCHEDULE = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
].map((day, index) => ({
  day,
  isActive: index < 5, // Active Mon-Fri by default
  timeSlots: [
    { id: `${day}-1`, time: '09:00', isActive: true, label: 'Morning' },
    { id: `${day}-2`, time: '12:00', isActive: true, label: 'Noon' },
    { id: `${day}-3`, time: '15:00', isActive: true, label: 'Afternoon' },
    { id: `${day}-4`, time: '18:00', isActive: true, label: 'Evening' },
  ],
}));

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  let settings = await ScheduleSettings.findOne({ userId: session.user.id }).lean();

  if (!settings) {
    // Return default structure if not configured
    return NextResponse.json({
      settings: null,
      needsSetup: true,
      defaults: {
        weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
        priorityThresholds: { highPriority: 7, mediumPriority: 14, lowPriority: 30 },
        frequencyMultipliers: { critical: 3, high: 2, medium: 1.5, low: 1 },
        contentRotation: { imageWeight: 40, videoWeight: 30, textWeight: 20, linkWeight: 10 },
        timezone: 'America/New_York',
      }
    });
  }

  return NextResponse.json({ settings, needsSetup: false });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const body = await req.json();
  const {
    whatsappChannelId,
    maytapiProductId,
    maytapiPhoneId,
    weeklySchedule,
    priorityThresholds,
    frequencyMultipliers,
    contentRotation,
    autoScheduleEnabled,
    autoScheduleDaysBefore,
    timezone,
  } = body;

  // Validate required Maytapi fields
  if (!whatsappChannelId || !maytapiProductId || !maytapiPhoneId) {
    return NextResponse.json(
      { error: 'WhatsApp channel configuration is required' },
      { status: 400 }
    );
  }

  const settings = await ScheduleSettings.findOneAndUpdate(
    { userId: session.user.id },
    {
      $set: {
        whatsappChannelId,
        maytapiProductId,
        maytapiPhoneId,
        weeklySchedule: weeklySchedule || DEFAULT_WEEKLY_SCHEDULE,
        priorityThresholds: priorityThresholds || { highPriority: 7, mediumPriority: 14, lowPriority: 30 },
        frequencyMultipliers: frequencyMultipliers || { critical: 3, high: 2, medium: 1.5, low: 1 },
        contentRotation: contentRotation || { imageWeight: 40, videoWeight: 30, textWeight: 20, linkWeight: 10 },
        autoScheduleEnabled: autoScheduleEnabled ?? true,
        autoScheduleDaysBefore: autoScheduleDaysBefore || 7,
        timezone: timezone || 'America/New_York',
      },
    },
    { new: true, upsert: true }
  );

  return NextResponse.json({ settings });
}

