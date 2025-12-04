import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { AppSettings, APP_SETTINGS_KEYS } from '@/lib/db/models';
import { getSession } from '@/lib/auth/session';

// GET /api/settings/image-generation
// Returns the image generation guidelines
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const setting = await AppSettings.findOne({ 
    key: APP_SETTINGS_KEYS.IMAGE_GENERATION_GUIDELINES 
  }).lean();

  return NextResponse.json({
    guidelines: setting?.value || '',
  });
}

// PUT /api/settings/image-generation
// Updates the image generation guidelines
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  try {
    const body = await req.json();
    const { guidelines } = body;

    if (typeof guidelines !== 'string') {
      return NextResponse.json(
        { error: 'Guidelines must be a string' },
        { status: 400 }
      );
    }

    // Upsert the setting
    await AppSettings.findOneAndUpdate(
      { key: APP_SETTINGS_KEYS.IMAGE_GENERATION_GUIDELINES },
      { 
        key: APP_SETTINGS_KEYS.IMAGE_GENERATION_GUIDELINES,
        value: guidelines,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      guidelines,
    });
  } catch (error) {
    console.error('Error saving image generation settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}

