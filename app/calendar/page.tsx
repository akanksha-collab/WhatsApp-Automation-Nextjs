'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Image, Video, FileText, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from 'date-fns';

interface ScheduledPost {
  _id: string;
  entityId: string;
  contentType: 'image' | 'video' | 'text' | 'youtube' | 'podcast' | 'article';
  message: string;
  scheduledAt: string;
  status: 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';
  entity?: {
    companyName: string;
    tickerSymbol: string;
  };
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 8 PM

export default function CalendarPage() {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

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
      if (res.ok) {
        alert(`Successfully scheduled ${data.postsCreated} posts!`);
        fetchPosts();
      } else {
        alert(data.error || 'Failed to generate schedule');
      }
    } catch (error) {
      console.error('Failed to generate schedule:', error);
      alert('Failed to generate schedule');
    } finally {
      setIsGenerating(false);
    }
  };

  const getPostsForDayAndHour = (day: Date, hour: number) => {
    return posts.filter(post => {
      const postDate = new Date(post.scheduledAt);
      return isSameDay(postDate, day) && postDate.getHours() === hour;
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
        <button
          onClick={handleAutoGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={18} className={isGenerating ? 'animate-spin' : ''} />
          {isGenerating ? 'Generating...' : 'Auto Generate Week'}
        </button>
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
                  <th className="w-16 p-3 text-xs font-semibold text-gray-500 text-left">Time</th>
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
                                className={`p-1.5 rounded text-xs border-l-2 ${getStatusColor(post.status)} cursor-pointer hover:opacity-80 transition-opacity`}
                                title={post.message}
                              >
                                <div className="flex items-center gap-1">
                                  {getContentIcon(post.contentType)}
                                  <span className="truncate font-medium">
                                    {post.message.slice(0, 20)}...
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
    </div>
  );
}
