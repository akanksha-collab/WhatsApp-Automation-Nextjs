'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Calendar, 
  AlertCircle, 
  Loader2, 
  Edit,
  Clock,
  Image,
  Video,
  Link as LinkIcon,
  FileText,
  History
} from 'lucide-react';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import ContentTab from '@/components/entities/ContentTab';
import HistoryTab from '@/components/entities/HistoryTab';
import ScheduledPostsTab from '@/components/entities/ScheduledPostsTab';

const NY_TIMEZONE = 'America/New_York';

interface EntityData {
  _id: string;
  companyName: string;
  tickerSymbol: string;
  leadPlaintiffDate: string;
  classPeriodStart?: string;
  classPeriodEnd?: string;
  caseDate?: string;
  allegations?: string;
  joinLink?: string;
  avatarVideo?: string;
  aiVideo?: string;
  podcastLink?: string;
  blogLink?: string;
  youtubeLink?: string;
  articleLinks: string[];
  images: { url: string }[];
  videos: { url: string }[];
  status: 'active' | 'completed' | 'paused';
  totalPostCount: number;
  lastPostedAt?: string;
  createdAt: string;
}

type TabType = 'overview' | 'content' | 'scheduled' | 'history';

export default function EntityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const [entity, setEntity] = useState<EntityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    fetchEntity();
  }, [id]);

  const fetchEntity = async () => {
    try {
      const res = await fetch(`/api/entities/${id}`);
      if (!res.ok) {
        setError('Entity not found');
        return;
      }
      const data = await res.json();
      setEntity(data);
    } catch {
      setError('Failed to load entity');
    } finally {
      setIsLoading(false);
    }
  };

  const getDaysUntilDeadline = (date: string) => {
    const deadlineInNY = startOfDay(toZonedTime(new Date(date), NY_TIMEZONE));
    const todayInNY = startOfDay(toZonedTime(new Date(), NY_TIMEZONE));
    return differenceInDays(deadlineInNY, todayInNY);
  };

  const getPriorityBadge = (days: number) => {
    if (days < 0) return { text: 'Expired', class: 'bg-gray-100 text-gray-600' };
    if (days === 0) return { text: 'Due Today', class: 'bg-red-100 text-red-600' };
    if (days <= 7) return { text: 'Critical', class: 'bg-red-100 text-red-600' };
    if (days <= 14) return { text: 'High', class: 'bg-amber-100 text-amber-600' };
    if (days <= 30) return { text: 'Medium', class: 'bg-whatsapp-light-green text-whatsapp-dark-teal' };
    return { text: 'Low', class: 'bg-gray-100 text-gray-600' };
  };

  const formatDate = (date: string) => {
    const dateInNY = toZonedTime(new Date(date), NY_TIMEZONE);
    return format(dateInNY, 'MMM d, yyyy');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-whatsapp-green" />
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{error || 'Entity not found'}</h2>
        <Link href="/entities" className="text-whatsapp-teal hover:text-whatsapp-dark-teal">
          Back to entities
        </Link>
      </div>
    );
  }

  const daysUntil = getDaysUntilDeadline(entity.leadPlaintiffDate);
  const priority = getPriorityBadge(daysUntil);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <FileText size={16} /> },
    { id: 'content', label: 'Content', icon: <Image size={16} /> },
    { id: 'scheduled', label: 'Scheduled Posts', icon: <Clock size={16} /> },
    { id: 'history', label: 'History', icon: <History size={16} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/entities"
            className="p-2 hover:bg-whatsapp-beige rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-whatsapp-dark-teal">
                {entity.companyName}
              </h1>
              <span className="text-lg text-gray-500">({entity.tickerSymbol})</span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${priority.class}`}>
                {priority.text}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Lead Plaintiff Deadline: {formatDate(entity.leadPlaintiffDate)}
              {daysUntil >= 0 && ` • ${daysUntil} days left`}
            </p>
          </div>
        </div>
        <Link
          href={`/entities/${entity._id}/edit`}
          className="flex items-center gap-2 px-4 py-2 border border-whatsapp-teal text-whatsapp-teal rounded-lg font-medium hover:bg-whatsapp-teal/10 transition-colors"
        >
          <Edit size={18} />
          Edit Entity
        </Link>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-whatsapp-green text-whatsapp-dark-teal'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Basic Info Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold tracking-wide text-whatsapp-dark-teal mb-4">
                BASIC INFORMATION
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status</span>
                  <span className="font-medium capitalize">{entity.status}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Posts</span>
                  <span className="font-medium">{entity.totalPostCount}</span>
                </div>
                {entity.lastPostedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Last Posted</span>
                    <span className="font-medium">{formatDate(entity.lastPostedAt)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Created</span>
                  <span className="font-medium">{formatDate(entity.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Important Dates Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-whatsapp-dark-teal mb-4">
                <Calendar size={16} />
                IMPORTANT DATES
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Lead Plaintiff Deadline</span>
                  <span className="font-medium">{formatDate(entity.leadPlaintiffDate)}</span>
                </div>
                {entity.classPeriodStart && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Class Period Start</span>
                    <span className="font-medium">{formatDate(entity.classPeriodStart)}</span>
                  </div>
                )}
                {entity.classPeriodEnd && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Class Period End</span>
                    <span className="font-medium">{formatDate(entity.classPeriodEnd)}</span>
                  </div>
                )}
                {entity.caseDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Case Filing Date</span>
                    <span className="font-medium">{formatDate(entity.caseDate)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Allegations Card */}
            {entity.allegations && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm lg:col-span-2">
                <h3 className="text-sm font-semibold tracking-wide text-whatsapp-dark-teal mb-4">
                  ALLEGATIONS
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{entity.allegations}</p>
              </div>
            )}

            {/* Links Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm lg:col-span-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-whatsapp-dark-teal mb-4">
                <LinkIcon size={16} />
                LINKS
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {entity.joinLink && (
                  <a
                    href={entity.joinLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-whatsapp-teal hover:text-whatsapp-dark-teal truncate"
                  >
                    Join Link →
                  </a>
                )}
                {entity.blogLink && (
                  <a
                    href={entity.blogLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-whatsapp-teal hover:text-whatsapp-dark-teal truncate"
                  >
                    Blog Link →
                  </a>
                )}
                {entity.youtubeLink && (
                  <a
                    href={entity.youtubeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-whatsapp-teal hover:text-whatsapp-dark-teal truncate"
                  >
                    YouTube →
                  </a>
                )}
                {entity.podcastLink && (
                  <a
                    href={entity.podcastLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-whatsapp-teal hover:text-whatsapp-dark-teal truncate"
                  >
                    Podcast →
                  </a>
                )}
                {entity.avatarVideo && (
                  <a
                    href={entity.avatarVideo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-whatsapp-teal hover:text-whatsapp-dark-teal truncate"
                  >
                    Avatar Video →
                  </a>
                )}
                {entity.aiVideo && (
                  <a
                    href={entity.aiVideo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-whatsapp-teal hover:text-whatsapp-dark-teal truncate"
                  >
                    AI Video →
                  </a>
                )}
              </div>
              {entity.articleLinks && entity.articleLinks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-medium text-gray-500 mb-2">Article Links</h4>
                  <div className="space-y-2">
                    {entity.articleLinks.map((link, index) => (
                      <a
                        key={index}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-whatsapp-teal hover:text-whatsapp-dark-teal truncate"
                      >
                        {link}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Media Stats Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold tracking-wide text-whatsapp-dark-teal mb-4">
                MEDIA
              </h3>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Image size={18} className="text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {entity.images?.length || 0} images
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Video size={18} className="text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {entity.videos?.length || 0} videos
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'content' && (
          <ContentTab 
            entityId={entity._id} 
            entity={{
              companyName: entity.companyName,
              tickerSymbol: entity.tickerSymbol,
              allegations: entity.allegations,
              leadPlaintiffDate: entity.leadPlaintiffDate,
            }}
          />
        )}

        {activeTab === 'scheduled' && (
          <ScheduledPostsTab entityId={entity._id} />
        )}

        {activeTab === 'history' && (
          <HistoryTab entityId={entity._id} />
        )}
      </div>
    </div>
  );
}

