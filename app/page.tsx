'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { differenceInDays, startOfDay, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { RefreshCw, AlertCircle, Calendar, Clock, Send, CheckCircle, XCircle } from 'lucide-react';

const NY_TIMEZONE = 'America/New_York';

interface Entity {
  _id: string;
  companyName: string;
  tickerSymbol: string;
  leadPlaintiffDate: string;
  status: string;
}

interface Post {
  _id: string;
  entityId: string;
  contentType: string;
  message: string;
  scheduledAt: string;
  status: string;
  templateName?: string;
  entity?: {
    companyName: string;
    tickerSymbol: string;
  };
}

interface DashboardStats {
  urgentCases: number;
  todayPosts: number;
  sentThisWeek: number;
  failedPosts: number;
  scheduledPosts: number;
}

export default function Dashboard() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    urgentCases: 0,
    todayPosts: 0,
    sentThisWeek: 0,
    failedPosts: 0,
    scheduledPosts: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch entities
      const entitiesRes = await fetch('/api/entities?status=active&limit=100');
      const entitiesData = await entitiesRes.json();
      const allEntities = entitiesData.entities || [];
      setEntities(allEntities);

      // Fetch posts
      const postsRes = await fetch('/api/posts?limit=100');
      const postsData = await postsRes.json();
      const allPosts = postsData.posts || [];
      setPosts(allPosts);

      // Calculate stats
      const now = new Date();
      const todayStart = startOfDay(toZonedTime(now, NY_TIMEZONE));
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);

      // Urgent cases (deadline within 7 days)
      const urgentCases = allEntities.filter((e: Entity) => {
        const deadline = new Date(e.leadPlaintiffDate);
        const daysLeft = differenceInDays(deadline, now);
        return daysLeft >= 0 && daysLeft <= 7;
      }).length;

      // Today's scheduled posts
      const todayPosts = allPosts.filter((p: Post) => {
        const postDate = toZonedTime(new Date(p.scheduledAt), NY_TIMEZONE);
        return startOfDay(postDate).getTime() === todayStart.getTime() && 
               (p.status === 'scheduled' || p.status === 'processing');
      }).length;

      // Sent this week
      const sentThisWeek = allPosts.filter((p: Post) => {
        return p.status === 'sent' && new Date(p.scheduledAt) >= weekStart;
      }).length;

      // Failed posts
      const failedPosts = allPosts.filter((p: Post) => p.status === 'failed').length;

      // Scheduled posts
      const scheduledPosts = allPosts.filter((p: Post) => p.status === 'scheduled').length;

      setStats({
        urgentCases,
        todayPosts,
        sentThisWeek,
        failedPosts,
        scheduledPosts,
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get upcoming deadlines (sorted by days left)
  const getUpcomingDeadlines = () => {
    const now = new Date();
    return entities
      .map(e => ({
        ...e,
        daysLeft: differenceInDays(new Date(e.leadPlaintiffDate), now),
      }))
      .filter(e => e.daysLeft >= 0)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  };

  // Get next posts today
  const getNextPosts = () => {
    const now = new Date();
    return posts
      .filter(p => {
        const postDate = new Date(p.scheduledAt);
        return postDate >= now && (p.status === 'scheduled' || p.status === 'processing');
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 5);
  };

  const upcomingDeadlines = getUpcomingDeadlines();
  const nextPosts = getNextPosts();

  const getPriorityColor = (daysLeft: number) => {
    if (daysLeft <= 7) return 'red';
    if (daysLeft <= 14) return 'amber';
    return 'whatsapp';
  };

  const formatTimeInNY = (dateStr: string) => {
    const date = toZonedTime(new Date(dateStr), NY_TIMEZONE);
    return format(date, 'h:mm a');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={32} className="text-whatsapp-green animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page title */}
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-whatsapp-dark-teal">Dashboard</h1>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-whatsapp-dark-teal transition-colors"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      {/* Top stats cards */}
      <section className="grid gap-6 md:grid-cols-4">
        <StatCard 
          label="Urgent Cases" 
          value={stats.urgentCases.toString()} 
          subtitle="≤7 days" 
          tone="red" 
          icon={<AlertCircle size={20} />}
        />
        <StatCard 
          label="Today's Posts" 
          value={stats.todayPosts.toString()} 
          subtitle="scheduled" 
          tone="whatsapp" 
          icon={<Calendar size={20} />}
        />
        <StatCard 
          label="Sent" 
          value={stats.sentThisWeek.toString()} 
          subtitle="this week" 
          tone="teal" 
          icon={<CheckCircle size={20} />}
        />
        <StatCard 
          label="Pending" 
          value={stats.scheduledPosts.toString()} 
          subtitle="scheduled" 
          tone="amber" 
          icon={<Clock size={20} />}
        />
      </section>

      {/* Failed posts alert */}
      {stats.failedPosts > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <XCircle size={20} className="text-red-500" />
          <div>
            <span className="font-medium text-red-700">{stats.failedPosts} failed post(s)</span>
            <span className="text-red-600 ml-2">- Check History page for details</span>
          </div>
          <Link 
            href="/history" 
            className="ml-auto text-sm font-medium text-red-600 hover:text-red-800"
          >
            View Failed →
          </Link>
        </div>
      )}

      {/* Bottom sections: Deadlines & Next posts */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming deadlines */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold tracking-wide text-whatsapp-dark-teal uppercase">
              Upcoming Deadlines
            </h2>
            <Link href="/entities" className="text-xs text-whatsapp-teal hover:underline">
              View All →
            </Link>
          </div>
          
          {upcomingDeadlines.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No active deadlines</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingDeadlines.map((entity) => (
                <DeadlineItem
                  key={entity._id}
                  color={getPriorityColor(entity.daysLeft)}
                  company={entity.companyName}
                  code={entity.tickerSymbol}
                  daysLeft={entity.daysLeft}
                />
              ))}
            </div>
          )}
        </div>

        {/* Next posts */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold tracking-wide text-whatsapp-dark-teal uppercase">
              Upcoming Posts
            </h2>
            <Link href="/calendar" className="text-xs text-whatsapp-teal hover:underline">
              View Calendar →
            </Link>
          </div>
          
          {nextPosts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Send size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No scheduled posts</p>
              <Link 
                href="/entities" 
                className="text-xs text-whatsapp-teal hover:underline mt-2 inline-block"
              >
                Schedule a post →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {nextPosts.map((post) => (
                <PostRow 
                  key={post._id}
                  time={formatTimeInNY(post.scheduledAt)}
                  company={post.entity?.companyName || 'Unknown'}
                  type={post.contentType}
                  template={post.templateName}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// Small reusable components:

function StatCard({ label, value, subtitle, tone = "whatsapp", icon }: {
  label: string;
  value: string;
  subtitle: string;
  tone?: "red" | "amber" | "whatsapp" | "teal";
  icon?: React.ReactNode;
}) {
  const toneMap = {
    red: "bg-red-100 text-red-600",
    amber: "bg-amber-100 text-amber-600",
    whatsapp: "bg-whatsapp-light-green text-whatsapp-dark-teal",
    teal: "bg-whatsapp-teal/10 text-whatsapp-teal",
  };

  const iconBgMap = {
    red: "bg-red-500",
    amber: "bg-amber-500",
    whatsapp: "bg-whatsapp-green",
    teal: "bg-whatsapp-teal",
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
          {label}
        </span>
        {icon && (
          <div className={`p-2 rounded-lg text-white ${iconBgMap[tone]}`}>
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-whatsapp-dark-teal">{value}</span>
        <span className="text-sm text-gray-600">{subtitle}</span>
      </div>
    </div>
  );
}

function DeadlineItem({ color = "red", company, code, daysLeft }: {
  color?: "red" | "amber" | "whatsapp";
  company: string;
  code: string;
  daysLeft: number;
}) {
  const dotColor =
    color === "red"
      ? "bg-red-500"
      : color === "amber"
      ? "bg-amber-500"
      : "bg-whatsapp-green";

  const badgeClass =
    color === "red"
      ? "bg-red-100 text-red-700"
      : color === "amber"
      ? "bg-amber-100 text-amber-700"
      : "bg-whatsapp-light-green text-whatsapp-dark-teal";

  return (
    <div className="flex items-center justify-between text-sm hover:bg-whatsapp-beige/50 p-2 rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
        <div>
          <div className="font-medium text-gray-900">
            {company} <span className="text-gray-500">({code})</span>
          </div>
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
        {daysLeft === 0 ? 'Today!' : daysLeft === 1 ? '1 day' : `${daysLeft} days`}
      </span>
    </div>
  );
}

function PostRow({ time, company, type, template }: {
  time: string;
  company: string;
  type: string;
  template?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm hover:bg-whatsapp-beige/50 p-2 rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        <div className="text-whatsapp-dark-teal font-mono font-semibold w-16">{time}</div>
        <div>
          <div className="font-medium text-gray-900">{company}</div>
          {template && (
            <div className="text-xs text-gray-500">{template}</div>
          )}
        </div>
      </div>
      <span className="text-xs px-3 py-1 rounded-full bg-whatsapp-light-green text-whatsapp-dark-teal font-medium capitalize">
        {type}
      </span>
    </div>
  );
}
