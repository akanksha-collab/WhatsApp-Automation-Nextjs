import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { generateDaySchedule } from '@/lib/scheduler/generator';

/**
 * POST /api/schedule/auto-generate-today
 * Generate schedule for today only
 * 
 * EDGE CASES HANDLED:
 * - EDGE CASE 2: Deadline is today - schedules remaining time slots
 * - EDGE CASE 3: Some posts already sent - keeps sent posts, only regenerates pending
 * - EDGE CASE 4: No active entities - returns appropriate message
 * - EDGE CASE 5: All time slots passed - returns appropriate message
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await generateDaySchedule({
      userId: session.user.id,
      // No targetDate means today
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        postsCreated: 0,
        message: result.message,
        details: result.details,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      postsCreated: result.postsCreated,
      message: result.message,
      details: result.details,
    });
  } catch (error) {
    console.error('Today schedule generation error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate schedule for today',
        postsCreated: 0,
      },
      { status: 500 }
    );
  }
}

