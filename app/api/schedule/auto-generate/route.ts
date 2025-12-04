import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { generateWeeklySchedule } from '@/lib/scheduler/generator';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const weekStartDate = body.weekStartDate 
      ? new Date(body.weekStartDate) 
      : undefined;

    const postsCreated = await generateWeeklySchedule({
      userId: session.user.id,
      weekStartDate,
    });

    return NextResponse.json({
      success: true,
      postsCreated,
      message: `Successfully scheduled ${postsCreated} posts`,
    });
  } catch (error) {
    console.error('Schedule generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate schedule' },
      { status: 500 }
    );
  }
}

