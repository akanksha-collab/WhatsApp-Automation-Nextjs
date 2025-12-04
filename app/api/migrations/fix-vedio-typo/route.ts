import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { MessageTemplate } from '@/lib/db/models/MessageTemplate';
import { getSession } from '@/lib/auth/session';

/**
 * Migration endpoint to fix "vedio" typo in template contentType field
 * 
 * This is a one-time migration that:
 * 1. Finds all templates with contentType "vedio" (misspelled)
 * 2. Updates them to contentType "video" (correct spelling)
 * 
 * Call this endpoint once via POST to run the migration.
 * The GET endpoint shows a preview of what will be affected.
 */

// GET: Preview what will be affected
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  // Find templates with the typo
  const templatesWithTypo = await MessageTemplate.find({
    contentType: 'vedio',
  }).lean();

  return NextResponse.json({
    message: 'Preview: Templates that will be updated',
    count: templatesWithTypo.length,
    templates: templatesWithTypo.map(t => ({
      _id: t._id,
      name: t.name,
      contentType: t.contentType,
      priority: t.priority,
    })),
  });
}

// POST: Run the migration
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  try {
    // Update all templates with "vedio" to "video"
    const result = await MessageTemplate.updateMany(
      { contentType: 'vedio' },
      { $set: { contentType: 'video' } }
    );

    return NextResponse.json({
      success: true,
      message: `Migration complete: Fixed ${result.modifiedCount} templates`,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    );
  }
}

