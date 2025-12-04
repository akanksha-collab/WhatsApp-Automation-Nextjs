import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { ScheduledPost } from '@/lib/db/models/ScheduledPost';
import { PostHistory } from '@/lib/db/models/PostHistory';
import { Entity } from '@/lib/db/models/Entity';
import { ScheduleSettings } from '@/lib/db/models/ScheduleSettings';
import { getMaytapiClient } from '@/lib/maytapi/client';

// This endpoint is called by a cron job (e.g., Vercel Cron)
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/process-queue", "schedule": "*/5 * * * *" }] }

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const now = new Date();
  
  // Find posts that should be sent
  const postsToSend = await ScheduledPost.find({
    status: 'scheduled',
    scheduledAt: { $lte: now },
  }).limit(10);

  const results: { postId: string; success: boolean; error?: string }[] = [];

  for (const post of postsToSend) {
    try {
      // Mark as processing
      post.status = 'processing';
      await post.save();

      // Get user settings for Maytapi config
      const settings = await ScheduleSettings.findOne({ userId: post.userId });
      if (!settings) {
        throw new Error('Settings not found');
      }

      const maytapi = getMaytapiClient();
      let response;

      // Send based on content type
      if (post.contentType === 'image' || post.contentType === 'video') {
        response = await maytapi.sendMediaMessage(
          settings.whatsappChannelId,
          post.mediaUrl!,
          post.message
        );
      } else if (post.link) {
        response = await maytapi.sendLinkMessage(
          settings.whatsappChannelId,
          post.message,
          post.link
        );
      } else {
        response = await maytapi.sendTextMessage(
          settings.whatsappChannelId,
          post.message
        );
      }

      if (response.success) {
        // Update post status
        post.status = 'sent';
        post.sentAt = new Date();
        post.maytapiMessageId = response.data?.msgId;
        await post.save();

        // Create history record
        await PostHistory.create({
          userId: post.userId,
          entityId: post.entityId,
          scheduledPostId: post._id.toString(),
          contentType: post.contentType,
          mediaUrl: post.mediaUrl,
          message: post.message,
          sentAt: new Date(),
          maytapiMessageId: response.data?.msgId || '',
          contentHash: `${post.contentType}:${post.mediaUrl || post.link || post.message}`,
        });

        // Update entity stats
        await Entity.findByIdAndUpdate(post.entityId, {
          $inc: { totalPostCount: 1 },
          $set: { lastPostedAt: new Date() },
        });

        results.push({ postId: post._id.toString(), success: true });
      } else {
        throw new Error(response.message || 'Maytapi send failed');
      }
    } catch (error) {
      post.status = 'failed';
      post.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await post.save();
      
      results.push({ 
        postId: post._id.toString(), 
        success: false, 
        error: post.errorMessage 
      });
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}

