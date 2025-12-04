import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { PostHistory } from '@/lib/db/models/PostHistory';
import { Entity } from '@/lib/db/models/Entity';
import { getSession } from '@/lib/auth/session';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get('entityId');
  const limit = parseInt(searchParams.get('limit') || '100');
  const page = parseInt(searchParams.get('page') || '1');

  const query: Record<string, unknown> = { userId: session.user.id };
  if (entityId) query.entityId = entityId;

  const [historyDocs, total] = await Promise.all([
    PostHistory.find(query)
      .sort({ sentAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PostHistory.countDocuments(query),
  ]);

  // Get entity details for each history entry
  const entityIds = [...new Set(historyDocs.map(h => h.entityId))];
  const entities = await Entity.find({ _id: { $in: entityIds } })
    .select('companyName tickerSymbol')
    .lean();

  const entityMap = new Map(entities.map(e => [e._id.toString(), e]));

  const history = historyDocs.map(h => ({
    ...h,
    entity: entityMap.get(h.entityId) || null,
  }));

  return NextResponse.json({
    history,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

