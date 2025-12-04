import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { Entity } from '@/lib/db/models/Entity';
import { ContentItem } from '@/lib/db/models/ContentItem';
import { getSession } from '@/lib/auth/session';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'active';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const sortBy = searchParams.get('sortBy') || 'leadPlaintiffDate';

  const query = { userId: session.user.id, status };
  
  const [entities, total] = await Promise.all([
    Entity.find(query)
      .sort({ [sortBy]: sortBy === 'leadPlaintiffDate' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Entity.countDocuments(query),
  ]);

  // Get content counts for each entity
  const entityIds = entities.map(e => e._id.toString());
  
  // Aggregate content counts by entity and type
  const contentCounts = await ContentItem.aggregate([
    {
      $match: {
        entityId: { $in: entityIds },
        isActive: true,
      },
    },
    {
      $group: {
        _id: { entityId: '$entityId', contentType: '$contentType' },
        count: { $sum: 1 },
      },
    },
  ]);

  // Create a map for quick lookup
  const countMap: Record<string, { images: number; videos: number }> = {};
  entityIds.forEach(id => {
    countMap[id] = { images: 0, videos: 0 };
  });
  
  contentCounts.forEach((item) => {
    const entityId = item._id.entityId;
    const contentType = item._id.contentType;
    if (countMap[entityId]) {
      if (contentType === 'image') {
        countMap[entityId].images = item.count;
      } else if (contentType === 'video') {
        countMap[entityId].videos = item.count;
      }
    }
  });

  // Add content counts to entities
  const entitiesWithCounts = entities.map(entity => ({
    ...entity,
    contentCounts: countMap[entity._id.toString()] || { images: 0, videos: 0 },
  }));

  return NextResponse.json({
    entities: entitiesWithCounts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const body = await req.json();
  const { 
    companyName, 
    tickerSymbol, 
    leadPlaintiffDate, 
    classPeriodStart,
    classPeriodEnd,
    caseDate,
    allegations,
    joinLink,
    avatarVideo,
    aiVideo,
    podcastLink,
    blogLink,
    youtubeLink,
    articleLinks,
  } = body;

  if (!companyName || !tickerSymbol || !leadPlaintiffDate) {
    return NextResponse.json(
      { error: 'Missing required fields: companyName, tickerSymbol, and leadPlaintiffDate are required' },
      { status: 400 }
    );
  }

  const entity = await Entity.create({
    userId: session.user.id,
    companyName,
    tickerSymbol: tickerSymbol.toUpperCase(),
    leadPlaintiffDate: new Date(leadPlaintiffDate),
    classPeriodStart: classPeriodStart ? new Date(classPeriodStart) : undefined,
    classPeriodEnd: classPeriodEnd ? new Date(classPeriodEnd) : undefined,
    caseDate: caseDate ? new Date(caseDate) : undefined,
    allegations,
    joinLink,
    avatarVideo,
    aiVideo,
    podcastLink,
    blogLink,
    youtubeLink,
    articleLinks: articleLinks || [],
    images: [],
    videos: [],
  });

  return NextResponse.json(entity, { status: 201 });
}
