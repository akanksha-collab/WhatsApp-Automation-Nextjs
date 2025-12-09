'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Image, Video, FileText, Link as LinkIcon, RefreshCw, CalendarDays, Plus, X, Filter, Search } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks, isBefore, startOfDay, parse } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
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

interface Entity {
  _id: string;
  companyName: string;
  tickerSymbol: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 12 AM to 11 PM (24 hours)

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'processing', label: 'Processing' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const CONTENT_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'text', label: 'Text' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'article', label: 'Article' },
];

export default function CalendarPage() {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingToday, setIsGeneratingToday] = useState(false);
  const [isGeneratingForDate, setIsGeneratingForDate] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  
  // Filter state
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterContentType, setFilterContentType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const toast = useToast();

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));

  useEffect(() => {
    fetchPosts();
  }, [currentWeek]);

  useEffect(() => {
    fetchEntities();
  }, []);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      // Get the week dates as YYYY-MM-DD strings (date only, no timezone confusion)
      const weekStartString = format(currentWeek, 'yyyy-MM-dd');
      const weekEndString = format(addDays(currentWeek, 7), 'yyyy-MM-dd');
      
      // Convert to UTC timestamps using NY timezone as the reference
      // This ensures we fetch posts scheduled for the correct NY calendar dates
      const startDateLocal = parse(`${weekStartString} 00:00`, 'yyyy-MM-dd HH:mm', new Date());
      const endDateLocal = parse(`${weekEndString} 00:00`, 'yyyy-MM-dd HH:mm', new Date());
      
      // Convert NY midnight to UTC for the query
      const startDateUTC = fromZonedTime(startDateLocal, NY_TIMEZONE);
      const endDateUTC = fromZonedTime(endDateLocal, NY_TIMEZONE);
      
      // Fetch all posts for the week (high limit) with ascending sort to ensure we get all posts
      const res = await fetch(`/api/posts?startDate=${startDateUTC.toISOString()}&endDate=${endDateUTC.toISOString()}&limit=500&sortOrder=asc`);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      toast.error('Failed to load posts', 'Unable to fetch scheduled posts from the server.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEntities = async () => {
    try {
      const res = await fetch('/api/entities?limit=100');
      const data = await res.json();
      setEntities(data.entities || []);
    } catch (error) {
      console.error('Failed to fetch entities:', error);
    }
  };

  // Filter posts based on selected filters
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      // Search filter - matches entity name, ticker, or message
      const matchesSearch = searchQuery === '' || 
        post.entity?.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.entity?.tickerSymbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.message.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Entity filter
      const matchesEntity = filterEntity === 'all' || post.entityId === filterEntity;
      
      // Status filter
      const matchesStatus = filterStatus === 'all' || post.status === filterStatus;
      
      // Content type filter
      const matchesContentType = filterContentType === 'all' || post.contentType === filterContentType;
      
      return matchesSearch && matchesEntity && matchesStatus && matchesContentType;
    });
  }, [posts, searchQuery, filterEntity, filterStatus, filterContentType]);

  const hasActiveFilters = filterEntity !== 'all' || filterStatus !== 'all' || filterContentType !== 'all' || searchQuery !== '';

  const clearFilters = () => {
    setFilterEntity('all');
    setFilterStatus('all');
    setFilterContentType('all');
    setSearchQuery('');
  };

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    try {
      // Send date as YYYY-MM-DD string to avoid timezone conversion issues
      const weekStartDateString = format(currentWeek, 'yyyy-MM-dd');
      const res = await fetch('/api/schedule/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStartDate: weekStartDateString }),
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

  const handleAutoGenerateForDate = async (date: Date) => {
    setIsGeneratingForDate(true);
    try {
      // Send date as YYYY-MM-DD string to avoid timezone conversion issues
      // This represents the calendar date the user clicked, not a specific moment in time
      const dateString = format(date, 'yyyy-MM-dd');
      const res = await fetch('/api/schedule/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: dateString, mode: 'day' }),
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success(
          'Schedule Generated!', 
          `Successfully scheduled ${data.postsCreated} posts for ${format(date, 'MMMM d, yyyy')}.`
        );
        fetchPosts();
        setIsDateModalOpen(false);
        setSelectedDate(null);
      } else {
        // Handle specific error messages for selected date
        handleScheduleErrorForDate(data, date);
      }
    } catch (error) {
      console.error('Failed to generate schedule for date:', error);
      toast.error('Generation Failed', 'An unexpected error occurred while generating the schedule.');
    } finally {
      setIsGeneratingForDate(false);
    }
  };

  const handleScheduleErrorForDate = (data: { message?: string; error?: string; details?: { skippedPastSlots?: number; skippedExpiredEntities?: number } }, date: Date) => {
    const message = data.message || data.error || 'Failed to generate schedule';
    const dateStr = format(date, 'MMMM d');
    
    // Determine error type and show appropriate toast
    if (message.includes('No active entities') || message.includes('No active entities to schedule')) {
      toast.warning(
        'No Cases to Schedule', 
        'No cases to schedule based on deadlines.'
      );
    } else if (message.includes('All time slots') && message.includes('passed')) {
      toast.warning(
        'No Time Slots Available', 
        `No time slots available for ${dateStr}.`
      );
    } else if (message.includes('All entities have expired') || message.includes('expired deadlines')) {
      toast.warning(
        'No Cases to Schedule', 
        'No cases to schedule based on deadlines.'
      );
    } else if (message.includes('not configured')) {
      toast.error(
        'Configuration Required', 
        message
      );
    } else if (message.includes('No active time slots')) {
      toast.warning(
        'No Time Slots Available', 
        `No time slots available for ${dateStr}.`
      );
    } else if (message.includes('is not configured for scheduling')) {
      toast.warning(
        'Day Not Configured', 
        `${format(date, 'EEEE')} is not configured for scheduling. Enable it in Schedule Settings.`
      );
    } else {
      toast.error('Schedule Generation Failed', message);
    }
  };

  const handleDateClick = (date: Date) => {
    // Only allow selecting today or future dates
    const today = startOfDay(new Date());
    if (isBefore(date, today)) {
      toast.warning('Cannot Schedule', 'Cannot generate schedule for past dates.');
      return;
    }
    setSelectedDate(date);
    setIsDateModalOpen(true);
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

  const handlePostDelete = async (postId: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success('Post Deleted', 'The scheduled post has been deleted successfully.');
        setIsPreviewOpen(false);
        setSelectedPost(null);
        fetchPosts();
      } else {
        toast.error('Delete Failed', data.error || 'Failed to delete the post.');
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
      toast.error('Delete Failed', 'An unexpected error occurred while deleting the post.');
    }
  };

  /**
   * Get posts for a specific day and hour, using NY timezone for comparison.
   * Posts are stored in UTC, so we need to convert to NY timezone before comparing.
   * Uses filteredPosts to respect active filters.
   */
  const getPostsForDayAndHour = (day: Date, hour: number) => {
    return filteredPosts.filter(post => {
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

      {/* Search and Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by entity name, ticker, or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          {/* Filter Toggle Button (Mobile) */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`lg:hidden flex items-center gap-2 px-4 py-2.5 border rounded-lg font-medium transition-colors ${
              hasActiveFilters 
                ? 'border-whatsapp-green bg-whatsapp-light-green text-whatsapp-dark-teal' 
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter size={18} />
            Filters
            {hasActiveFilters && (
              <span className="bg-whatsapp-green text-white text-xs px-1.5 py-0.5 rounded-full">
                {[filterEntity !== 'all', filterStatus !== 'all', filterContentType !== 'all'].filter(Boolean).length}
              </span>
            )}
          </button>

          {/* Desktop Filters */}
          <div className="hidden lg:flex items-center gap-3">
            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent bg-white text-sm min-w-[160px]"
            >
              <option value="all">All Entities</option>
              {entities.map(entity => (
                <option key={entity._id} value={entity._id}>
                  {entity.companyName} ({entity.tickerSymbol})
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent bg-white text-sm"
            >
              {STATUS_OPTIONS.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>

            <select
              value={filterContentType}
              onChange={(e) => setFilterContentType(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent bg-white text-sm"
            >
              {CONTENT_TYPE_OPTIONS.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={16} />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Mobile Filters Dropdown */}
        {showFilters && (
          <div className="lg:hidden mt-4 pt-4 border-t border-gray-100 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Entity</label>
              <select
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent bg-white text-sm"
              >
                <option value="all">All Entities</option>
                {entities.map(entity => (
                  <option key={entity._id} value={entity._id}>
                    {entity.companyName} ({entity.tickerSymbol})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent bg-white text-sm"
              >
                {STATUS_OPTIONS.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Content Type</label>
              <select
                value={filterContentType}
                onChange={(e) => setFilterContentType(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent bg-white text-sm"
              >
                {CONTENT_TYPE_OPTIONS.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg transition-colors"
              >
                <X size={16} />
                Clear All Filters
              </button>
            )}
          </div>
        )}

        {/* Results count */}
        {posts.length > 0 && (
          <div className="mt-3 text-sm text-gray-500">
            Showing {filteredPosts.length} of {posts.length} posts this week
            {hasActiveFilters && ' (filtered)'}
          </div>
        )}
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
                  {weekDays.map((day) => {
                    const isToday = isSameDay(day, new Date());
                    const isPast = isBefore(day, startOfDay(new Date()));
                    return (
                      <th 
                        key={day.toISOString()} 
                        className={`p-3 text-center ${!isPast ? 'cursor-pointer hover:bg-whatsapp-beige/50 transition-colors' : ''}`}
                        onClick={() => !isPast && handleDateClick(day)}
                        title={!isPast ? `Click to generate schedule for ${format(day, 'MMMM d')}` : undefined}
                      >
                        <div className={`text-xs font-semibold ${
                          isToday ? 'text-whatsapp-green' : isPast ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {format(day, 'EEE')}
                        </div>
                        <div className={`text-lg font-semibold ${
                          isToday 
                            ? 'bg-whatsapp-green text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto' 
                            : isPast ? 'text-gray-400' : 'text-gray-900'
                        }`}>
                          {format(day, 'd')}
                        </div>
                        {!isPast && (
                          <div className="mt-1 opacity-0 hover:opacity-100 transition-opacity">
                            <Plus size={14} className="mx-auto text-whatsapp-teal" />
                          </div>
                        )}
                      </th>
                    );
                  })}
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
        onDelete={handlePostDelete}
      />

      {/* Date Selection Modal for Auto-Generate */}
      {isDateModalOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 animate-fade-in" 
            onClick={() => {
              setIsDateModalOpen(false);
              setSelectedDate(null);
            }}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-whatsapp-beige/50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <CalendarDays size={20} className="text-whatsapp-teal" />
                <div>
                  <h2 className="font-semibold text-gray-900">Auto-Generate Schedule</h2>
                  <p className="text-sm text-gray-500">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsDateModalOpen(false);
                  setSelectedDate(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-gray-600 mb-6">
                This will automatically generate scheduled posts for{' '}
                <span className="font-semibold text-gray-900">{format(selectedDate, 'MMMM d, yyyy')}</span>{' '}
                based on your active cases and configured time slots.
              </p>
              
              <div className="bg-whatsapp-light-green/30 rounded-xl p-4 mb-6">
                <h3 className="font-medium text-whatsapp-dark-teal mb-2">What happens:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Existing scheduled posts for this date will be replaced</li>
                  <li>• Posts are distributed based on case priority</li>
                  <li>• Higher priority cases (closer deadlines) get more slots</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsDateModalOpen(false);
                    setSelectedDate(null);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAutoGenerateForDate(selectedDate)}
                  disabled={isGeneratingForDate}
                  className="flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={18} className={isGeneratingForDate ? 'animate-spin' : ''} />
                  {isGeneratingForDate ? 'Generating...' : `Generate for ${format(selectedDate, 'MMM d')}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
