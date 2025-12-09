import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { generateWeeklySchedule, generateDaySchedule, ScheduleGenerationResult } from '@/lib/scheduler/generator';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { weekStartDate, targetDate, mode } = body;
    
    let result: ScheduleGenerationResult;
    
    if (mode === 'day' || targetDate) {
      // Generate for a single day
      // targetDate is expected as YYYY-MM-DD string from client
      result = await generateDaySchedule({
        userId: session.user.id,
        targetDate: targetDate || undefined,
      });
    } else {
      // Generate for the week
      // weekStartDate is expected as YYYY-MM-DD string from client
      result = await generateWeeklySchedule({
        userId: session.user.id,
        weekStartDate: weekStartDate || undefined,
      });
    }

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
    console.error('Schedule generation error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate schedule',
        postsCreated: 0,
      },
      { status: 500 }
    );
  }
}
