'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Calendar, AlertCircle, AlertTriangle, Image, Video, Link as LinkIcon, MoreVertical, Edit, Trash2, Clock, Send, X, Zap, Globe } from 'lucide-react';
import { format, differenceInDays, startOfDay, addMinutes, parse } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// All calculations use America/New_York timezone
const NY_TIMEZONE = 'America/New_York';
const IST_TIMEZONE = 'Asia/Kolkata';

interface Entity {
  _id: string;
  companyName: string;
  tickerSymbol: string;
  leadPlaintiffDate: string;
  caseDate?: string;
  classPeriodStart?: string;
  classPeriodEnd?: string;
  description?: string;
  allegations?: string;
  joinLink?: string;
  avatarVideo?: string;
  aiVideo?: string;
  blogLink?: string;
  images: { url: string }[];
  videos: { url: string }[];
  youtubeLink?: string;
  podcastLink?: string;
  articleLinks: string[];
  status: 'active' | 'completed' | 'paused';
  totalPostCount: number;
  contentCounts?: {
    images: number;
    videos: number;
  };
}

// Check which placeholders in a template are missing from entity
function findMissingPlaceholders(templateContent: string, entity: Entity): string[] {
  const placeholderChecks: { placeholder: string; check: () => boolean }[] = [
    { placeholder: '[Company Name]', check: () => !!entity.companyName },
    { placeholder: '[Ticker]', check: () => !!entity.tickerSymbol },
    { placeholder: '[Lead Plaintiff Deadline]', check: () => !!entity.leadPlaintiffDate },
    { placeholder: '[Days Remaining]', check: () => !!entity.leadPlaintiffDate },
    { placeholder: '[Class Period Start]', check: () => !!entity.classPeriodStart },
    { placeholder: '[Class Period End]', check: () => !!entity.classPeriodEnd },
    { placeholder: '[Case Date]', check: () => !!entity.caseDate },
    { placeholder: '[Allegations]', check: () => !!entity.allegations },
    { placeholder: '[Join Link]', check: () => !!entity.joinLink },
    { placeholder: '[Avatar Video]', check: () => !!entity.avatarVideo },
    { placeholder: '[AI Video]', check: () => !!entity.aiVideo },
    { placeholder: '[Podcast Link]', check: () => !!entity.podcastLink },
    { placeholder: '[Blog Link]', check: () => !!entity.blogLink },
    { placeholder: '[YouTube Link]', check: () => !!entity.youtubeLink },
  ];

  const missing: string[] = [];
  const lowerTemplate = templateContent.toLowerCase();
  
  for (const { placeholder, check } of placeholderChecks) {
    if (lowerTemplate.includes(placeholder.toLowerCase()) && !check()) {
      missing.push(placeholder);
    }
  }
  
  return missing;
}

interface Template {
  _id: string;
  name: string;
  contentType: string;
  priority: string;
  template: string;
  isDefault: boolean;
}

export default function EntitiesPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  
  // Schedule Modal State
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templateWarning, setTemplateWarning] = useState<string[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [currentNYTime, setCurrentNYTime] = useState<string>('');

  useEffect(() => {
    fetchEntities();
    fetchTemplates();
  }, [statusFilter]);

  // Update current NY time every second when modal is open
  useEffect(() => {
    if (scheduleModalOpen) {
      const updateTime = () => {
        const now = new Date();
        const nyTime = toZonedTime(now, NY_TIMEZONE);
        setCurrentNYTime(format(nyTime, 'HH:mm:ss'));
      };
      updateTime();
      const interval = setInterval(updateTime, 1000);
      return () => clearInterval(interval);
    }
  }, [scheduleModalOpen]);

  const fetchEntities = async () => {
    try {
      const res = await fetch(`/api/entities?status=${statusFilter}`);
      const data = await res.json();
      setEntities(data.entities || []);
    } catch (error) {
      console.error('Failed to fetch entities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  // Calculate days until deadline using America/New_York timezone
  const getDaysUntilDeadline = (date: string) => {
    const deadlineInNY = startOfDay(toZonedTime(new Date(date), NY_TIMEZONE));
    const todayInNY = startOfDay(toZonedTime(new Date(), NY_TIMEZONE));
    return differenceInDays(deadlineInNY, todayInNY);
  };

  const getPriorityColor = (days: number) => {
    if (days < 0) return 'bg-gray-400';
    if (days === 0) return 'bg-red-500';
    if (days <= 7) return 'bg-red-500';
    if (days <= 14) return 'bg-amber-500';
    if (days <= 30) return 'bg-whatsapp-green';
    return 'bg-gray-400';
  };

  const getPriorityBadge = (days: number) => {
    if (days < 0) return { text: 'Expired', class: 'bg-gray-100 text-gray-600' };
    if (days === 0) return { text: 'Due Today', class: 'bg-red-100 text-red-600' };
    if (days <= 7) return { text: 'Critical', class: 'bg-red-100 text-red-600' };
    if (days <= 14) return { text: 'High', class: 'bg-amber-100 text-amber-600' };
    if (days <= 30) return { text: 'Medium', class: 'bg-whatsapp-light-green text-whatsapp-dark-teal' };
    return { text: 'Low', class: 'bg-gray-100 text-gray-600' };
  };

  const getDaysLeftText = (days: number) => {
    if (days < 0) return 'Deadline passed';
    if (days === 0) return 'Due today!';
    if (days === 1) return '1 day left';
    return `${days} days left`;
  };

  const filteredEntities = entities.filter(entity =>
    entity.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entity.tickerSymbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this entity?')) return;
    
    try {
      const res = await fetch(`/api/entities/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEntities(entities.filter(e => e._id !== id));
      }
    } catch (error) {
      console.error('Failed to delete entity:', error);
    }
  };

  const formatDateInNY = (date: string) => {
    const dateInNY = toZonedTime(new Date(date), NY_TIMEZONE);
    return format(dateInNY, 'MMM d, yyyy');
  };

  // Get current time in NY timezone
  const getNYTime = () => {
    return toZonedTime(new Date(), NY_TIMEZONE);
  };

  // Convert NY time string to UTC Date
  const nyTimeToUTC = (dateStr: string, timeStr: string): Date => {
    // Parse the date and time as if they are in NY timezone
    const nyDateTime = parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', new Date());
    // Convert from NY timezone to UTC
    return fromZonedTime(nyDateTime, NY_TIMEZONE);
  };

  // Format a UTC date to NY time for display
  const formatInNY = (date: Date): string => {
    const nyTime = toZonedTime(date, NY_TIMEZONE);
    return format(nyTime, 'MMM d, yyyy h:mm a');
  };

  // Format a UTC date to IST time for display
  const formatInIST = (date: Date): string => {
    const istTime = toZonedTime(date, IST_TIMEZONE);
    return format(istTime, 'MMM d, yyyy h:mm a');
  };

  // Open schedule modal
  const openScheduleModal = (entity: Entity, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEntity(entity);
    setCustomMessage('');
    
    // Auto-select default template if available
    const defaultTemplate = templates.find(t => t.isDefault);
    setSelectedTemplate(defaultTemplate?._id || '');
    
    // Check for missing placeholders if default template is selected
    if (defaultTemplate) {
      const missing = findMissingPlaceholders(defaultTemplate.template, entity);
      setTemplateWarning(missing);
    } else {
      setTemplateWarning([]);
    }
    
    // Set default date/time to current NY time
    const nyNow = getNYTime();
    setScheduleDate(format(nyNow, 'yyyy-MM-dd'));
    setScheduleTime(format(nyNow, 'HH:mm'));
    setScheduleModalOpen(true);
  };

  // Quick schedule (1 min, 5 min, 15 min from now)
  const quickSchedule = async (minutes: number) => {
    if (!selectedEntity) return;
    
    // Add minutes to current time (this works correctly regardless of timezone)
    const scheduledAt = addMinutes(new Date(), minutes);
    await schedulePost(scheduledAt);
  };

  // Schedule post with custom date/time (in NY timezone)
  const scheduleCustom = async () => {
    if (!selectedEntity || !scheduleDate || !scheduleTime) return;
    
    // Convert NY time input to UTC
    const scheduledAt = nyTimeToUTC(scheduleDate, scheduleTime);
    await schedulePost(scheduledAt);
  };

  // Get preview time for custom schedule
  const getSchedulePreview = () => {
    if (!scheduleDate || !scheduleTime) return null;
    try {
      const utcTime = nyTimeToUTC(scheduleDate, scheduleTime);
      return {
        ny: formatInNY(utcTime),
        ist: formatInIST(utcTime),
      };
    } catch {
      return null;
    }
  };

  // Schedule the post
  const schedulePost = async (scheduledAt: Date) => {
    if (!selectedEntity) return;
    
    setIsScheduling(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: selectedEntity._id,
          templateId: selectedTemplate || undefined,
          customMessage: customMessage || undefined,
          scheduledAt: scheduledAt.toISOString(),
        }),
      });

      if (res.ok) {
        const nyTimeStr = formatInNY(scheduledAt);
        alert(`Post scheduled for ${nyTimeStr} (NY Time)`);
        setScheduleModalOpen(false);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to schedule post');
      }
    } catch (error) {
      console.error('Failed to schedule post:', error);
      alert('Failed to schedule post');
    } finally {
      setIsScheduling(false);
    }
  };

  // Navigate to entity detail page
  const handleCardClick = (entityId: string) => {
    router.push(`/entities/${entityId}`);
  };

  const schedulePreview = getSchedulePreview();

  return (
    <div className="space-y-8">
      {/* Page header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-whatsapp-dark-teal">
            Entities
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage your securities class action cases
          </p>
        </div>
        <Link
          href="/entities/new"
          className="flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors shadow-sm"
        >
          <Plus size={20} />
          Add Entity
        </Link>
      </header>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent transition-all"
            placeholder="Search by company name or ticker..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent bg-white"
        >
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Entities Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filteredEntities.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No entities found</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding your first entity'}
          </p>
          {!searchTerm && (
            <Link
              href="/entities/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors"
            >
              <Plus size={20} />
              Add Entity
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredEntities.map((entity) => {
            const daysUntil = getDaysUntilDeadline(entity.leadPlaintiffDate);
            const priority = getPriorityBadge(daysUntil);
            
            // Get content counts from API response or fallback to legacy arrays
            const imageCount = entity.contentCounts?.images ?? entity.images?.length ?? 0;
            const videoCount = entity.contentCounts?.videos ?? entity.videos?.length ?? 0;
            const linkCount = (entity.articleLinks?.length || 0) + 
                             (entity.youtubeLink ? 1 : 0) + 
                             (entity.podcastLink ? 1 : 0);
            
            return (
              <div
                key={entity._id}
                onClick={() => handleCardClick(entity._id)}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-whatsapp-green/50"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full ${getPriorityColor(daysUntil)}`} />
                    <div>
                      <h3 className="font-semibold text-gray-900">{entity.companyName}</h3>
                      <span className="text-sm text-gray-500">{entity.tickerSymbol}</span>
                    </div>
                  </div>
                  <div className="relative group" onClick={(e) => e.stopPropagation()}>
                    <button className="p-2 hover:bg-whatsapp-beige rounded-lg transition-colors">
                      <MoreVertical size={18} className="text-gray-500" />
                    </button>
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[140px]">
                      <button
                        onClick={(e) => openScheduleModal(entity, e)}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-whatsapp-light-green text-sm text-whatsapp-dark-teal w-full"
                      >
                        <Send size={16} />
                        Schedule Post
                      </button>
                      <Link
                        href={`/entities/${entity._id}/edit`}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-whatsapp-beige text-sm text-gray-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Edit size={16} />
                        Edit
                      </Link>
                      <button
                        onClick={(e) => handleDelete(entity._id, e)}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-red-50 text-sm text-red-600 w-full"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={16} className="text-gray-400" />
                    <span className="text-gray-600">
                      Lead Plaintiff: {formatDateInNY(entity.leadPlaintiffDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Image size={14} /> {imageCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Video size={14} /> {videoCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <LinkIcon size={14} /> {linkCount}
                    </span>
                  </div>
                </div>

                {/* Schedule Button */}
                <button
                  onClick={(e) => openScheduleModal(entity, e)}
                  className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors"
                >
                  <Send size={16} />
                  Schedule Post
                </button>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${priority.class}`}>
                    {priority.text}
                  </span>
                  <span className="text-sm text-gray-500">
                    {getDaysLeftText(daysUntil)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Modal */}
      {scheduleModalOpen && selectedEntity && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setScheduleModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Schedule Post</h2>
                <p className="text-sm text-gray-500">{selectedEntity.companyName} ({selectedEntity.tickerSymbol})</p>
              </div>
              <button 
                onClick={() => setScheduleModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Current NY Time Display */}
            <div className="px-6 pt-4">
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Globe size={16} className="text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">Current NY Time</span>
                </div>
                <span className="text-lg font-mono font-bold text-blue-800">{currentNYTime}</span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Quick Schedule Buttons */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <Zap size={16} className="inline mr-1" />
                  Quick Schedule <span className="text-gray-400 font-normal">(from now)</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => quickSchedule(1)}
                    disabled={isScheduling}
                    className="px-4 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    1 min
                  </button>
                  <button
                    onClick={() => quickSchedule(5)}
                    disabled={isScheduling}
                    className="px-4 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
                  >
                    5 min
                  </button>
                  <button
                    onClick={() => quickSchedule(15)}
                    disabled={isScheduling}
                    className="px-4 py-3 bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors disabled:opacity-50"
                  >
                    15 min
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or custom time</span>
                </div>
              </div>

              {/* Custom Date/Time - IN NY TIMEZONE */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Globe size={16} className="text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Schedule in New York Time (NY)</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Calendar size={14} className="inline mr-1" />
                      Date <span className="text-blue-600 font-normal">(NY)</span>
                    </label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Clock size={14} className="inline mr-1" />
                      Time <span className="text-blue-600 font-normal">(NY)</span>
                    </label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Preview both timezones */}
                {schedulePreview && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs font-medium text-gray-500 uppercase mb-2">Will be sent at:</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">🇺🇸 New York:</span>
                        <span className="font-medium text-gray-900">{schedulePreview.ny}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">🇮🇳 India (IST):</span>
                        <span className="font-medium text-gray-900">{schedulePreview.ist}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Template Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Template (optional)
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => {
                    const templateId = e.target.value;
                    setSelectedTemplate(templateId);
                    
                    // Check for missing placeholders
                    if (templateId && selectedEntity) {
                      const template = templates.find(t => t._id === templateId);
                      if (template) {
                        const missing = findMissingPlaceholders(template.template, selectedEntity);
                        setTemplateWarning(missing);
                      } else {
                        setTemplateWarning([]);
                      }
                    } else {
                      setTemplateWarning([]);
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent bg-white"
                >
                  <option value="">Use default message</option>
                  {templates.map((template) => (
                    <option key={template._id} value={template._id}>
                      {template.name} ({template.contentType} - {template.priority})
                      {template.isDefault ? ' ⭐ Default' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Warning */}
              {templateWarning.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Missing entity data for placeholders:</p>
                    <p className="text-amber-600">{templateWarning.join(', ')}</p>
                    <p className="text-xs mt-1 text-amber-500">These fields will be empty in the message.</p>
                  </div>
                </div>
              )}

              {/* Custom Message (if no template) */}
              {!selectedTemplate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Message (optional)
                  </label>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent resize-none"
                    placeholder="Leave empty to use default message..."
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setScheduleModalOpen(false)}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={scheduleCustom}
                disabled={isScheduling || !scheduleDate || !scheduleTime}
                className="flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg font-medium hover:bg-whatsapp-teal transition-colors disabled:opacity-50"
              >
                <Send size={16} />
                {isScheduling ? 'Scheduling...' : 'Schedule Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
