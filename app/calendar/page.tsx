'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Image, Video, FileText, Link as LinkIcon, RefreshCw, CalendarDays } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useToast } from '@/components/ui/Toast';
import PostPreviewModal from '@/components/ui/PostPreviewModal';

// All date/time operations should use NY timezone for consistency
const NY_TIMEZONE = 'America/New_York';

interface ScheduledPost {
  _id: string;
  entityId: string;
  contentType: 'image' | 'video' | 'text' | 'youtube' | 'podcast' | 'article';
  contentId?: string;
  mediaUrl?: string;
  message: string;
  link?: string;
  templateId?: string;
  templateName?: string;
  scheduledAt: string;
  scheduledDay: string;
  status: 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';
  sentAt?: string;
  errorMessage?: string;
  entity?: {
    companyName: string;
    tickerSymbol: string;
    leadPlaintiffDate?: string;
  };
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 5); // 5 AM to 10 PM

export default function CalendarPage() {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingToday, setIsGeneratingToday] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  const toast = useToast();

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));

  useEffect(() => {
    fetchPosts();
  }, [currentWeek]);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const startDate = currentWeek.toISOString();
      const endDate = addDays(currentWeek, 7).toISOString();
      const res = await fetch(`/api/posts?startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      toast.error('Failed to load posts', 'Unable to fetch scheduled posts from the server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/schedule/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStartDate: currentWeek.toISOString() }),
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success(
          'Schedule Generated!', 
          `Successfully scheduled ${data.postsCreated} posts for the week.`
        );
        fetchPosts();
      } else {
        // Handle specific error messages
        handleScheduleError(data);
      }
    } catch (error) {
      console.error('Failed to generate schedule:', error);
      toast.error('Generation Failed', 'An unexpected error occurred while generating the schedule.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAutoGenerateToday = async () => {
    setIsGeneratingToday(true);
    try {
      const res = await fetch('/api/schedule/auto-generate-today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success(
          'Today\'s Schedule Generated!', 
          `Successfully scheduled ${data.postsCreated} posts for today.`
        );
        fetchPosts();
      } else {
        // Handle specific error messages
        handleScheduleError(data);
      }
    } catch (error) {
      console.error('Failed to generate today\'s schedule:', error);
      toast.error('Generation Failed', 'An unexpected error occurred while generating today\'s schedule.');
    } finally {
      setIsGeneratingToday(false);
    }
  };

  const handleScheduleError = (data: { message?: string; error?: string; details?: { skippedPastSlots?: number; skippedExpiredEntities?: number } }) => {
    const message = data.message || data.error || 'Failed to generate schedule';
    
    // Determine error type and show appropriate toast
    if (message.includes('No active entities')) {
      toast.warning(
        'No Active Cases', 
        'All entities are either expired or paused. Add or activate entities to schedule posts.'
      );
    } else if (message.includes('All time slots') && message.includes('passed')) {
      toast.warning(
        'No Available Time Slots', 
        'All time slots for this period have already passed. Try scheduling for a future date.'
      );
    } else if (message.includes('expired')) {
      toast.warning(
        'Deadlines Passed', 
        'All entity deadlines have passed for this date. No posts were scheduled.'
      );
    } else if (message.includes('not configured')) {
      toast.error(
        'Configuration Required', 
        message
      );
    } else if (message.includes('No active time slots')) {
      toast.warning(
        'No Time Slots', 
        'No active time slots are configured. Go to Schedule Settings to add time slots.'
      );
    } else {
      toast.error('Schedule Generation Failed', message);
    }
  };

  const handlePostClick = (post: ScheduledPost) => {
    setSelectedPost(post);
    setIsPreviewOpen(true);
  };

  /**
   * Get posts for a specific day and hour, using NY timezone for comparison.
   * Posts are stored in UTC, so we need to convert to NY timezone before comparing.
   */
  const getPostsForDayAndHour = (day: Date, hour: number) => {
    return posts.filter(post => {
      // Convert the UTC scheduled time to NY timezone for proper comparison
      const postDateInNY = toZonedTime(new Date(post.scheduledAt), NY_TIMEZONE);
      
      // Compare date components directly:
      // - postDateInNY has adjusted values showing NY time (getDate/getMonth/etc return NY values)
      // - day is the calendar day we're rendering (already represents the correct date)
      // DO NOT convert 'day' with toZonedTime - it's already the calendar date we want
      const isSameDate = 
        postDateInNY.getFullYear() === day.getFullYear() &&
        postDateInNY.getMonth() === day.getMonth() &&
        postDateInNY.getDate() === day.getDate();
      
      return isSameDate && postDateInNY.getHours() === hour;
    });
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image size={12} />;
      case 'video': return <Video size={12} />;
      case 'youtube':
      case 'podcast':
      case 'article': return <LinkIcon size={12} />;
      default: return <FileText size={12} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-whatsapp-light-green border-whatsapp-green';
      case 'sent': return 'bg-blue-100 border-blue-400';
      case 'failed': return 'bg-red-100 border-red-400';
      case 'cancelled': return 'bg-gray-100 border-gray-400';
      default: return 'bg-amber-100 border-amber-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-whatsapp-dark-teal">
            Calendar
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Visual view of all scheduled posts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAutoGenerateToday}
            disabled={isGeneratingToday}
            className="flex items-center gap-2 px-4 py-2 bg-whatsapp-teal text-white rounded-lg font-medium hover:bg-whatsapp-dark-teal transition-colors shadow-sm disabled:opacity-50"
          >
            <CalendarDays size={18} className={isGeneratingToday ? 'animate-pulse' : ''} />
            {isGeneratingToday ? 'Generating...' : 'Generate Today'}
          </button>
          <button
            onClick={handleAutoGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={18} className={isGenerating ? 'animate-spin' : ''} />
            {isGenerating ? 'Generating...' : 'Auto Generate Week'}
          </button>
        </div>
      </header>

      {/* Week Navigation */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <button
          onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
          className="p-2 hover:bg-whatsapp-beige rounded-lg transition-colors"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <div className="text-center">
          <h2 className="font-semibold text-gray-900">
            {format(currentWeek, 'MMMM d')} - {format(addDays(currentWeek, 6), 'MMMM d, yyyy')}
          </h2>
          <button
            onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="text-sm text-whatsapp-teal hover:text-whatsapp-dark-teal font-medium"
          >
            Go to today
          </button>
        </div>
        <button
          onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
          className="p-2 hover:bg-whatsapp-beige rounded-lg transition-colors"
        >
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading calendar...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="w-16 p-3 text-xs font-semibold text-gray-500 text-left">
                    <span>Time</span>
                    <span className="block text-[10px] text-blue-500 font-normal">(NY)</span>
                  </th>
                  {weekDays.map((day) => (
                    <th key={day.toISOString()} className="p-3 text-center">
                      <div className={`text-xs font-semibold ${
                        isSameDay(day, new Date()) ? 'text-whatsapp-green' : 'text-gray-500'
                      }`}>
                        {format(day, 'EEE')}
                      </div>
                      <div className={`text-lg font-semibold ${
                        isSameDay(day, new Date()) 
                          ? 'bg-whatsapp-green text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto' 
                          : 'text-gray-900'
                      }`}>
                        {format(day, 'd')}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour} className="border-b border-gray-100">
                    <td className="p-3 text-xs text-gray-500 align-top">
                      {format(new Date().setHours(hour, 0), 'h a')}
                    </td>
                    {weekDays.map((day) => {
                      const dayPosts = getPostsForDayAndHour(day, hour);
                      return (
                        <td key={day.toISOString()} className="p-1 align-top h-16 border-l border-gray-100">
                          <div className="space-y-1">
                            {dayPosts.map((post) => (
                              <div
                                key={post._id}
                                onClick={() => handlePostClick(post)}
                                className={`p-1.5 rounded text-xs border-l-2 ${getStatusColor(post.status)} cursor-pointer hover:opacity-80 hover:shadow-md transition-all`}
                                title="Click to view details"
                              >
                                <div className="flex items-center gap-1">
                                  {getContentIcon(post.contentType)}
                                  <span className="truncate font-medium">
                                    {post.entity?.tickerSymbol || post.message.slice(0, 15)}...
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-whatsapp-light-green border border-whatsapp-green" />
          <span>Scheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-blue-100 border border-blue-400" />
          <span>Sent</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-400" />
          <span>Failed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-amber-100 border border-amber-400" />
          <span>Processing</span>
        </div>
      </div>

      {/* Post Preview Modal */}
      <PostPreviewModal
        post={selectedPost}
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setSelectedPost(null);
        }}
      />
    </div>
  );
}
