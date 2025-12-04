'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Calendar as CalendarIcon, 
  Settings,
  Sun,
  Moon,
  History
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/entities', label: 'Entities', icon: Users },
  { path: '/templates', label: 'Templates', icon: FileText },
  { path: '/calendar', label: 'Calendar', icon: CalendarIcon },
  { path: '/history', label: 'History', icon: History },
  { path: '/schedule-settings', label: 'Settings', icon: Settings },
];

// Format time for a specific timezone in 24-hour format
function formatTimeForZone(date: Date, timeZone: string): string {
  return date.toLocaleTimeString('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Check if it's daytime (6 AM - 6 PM)
function isDaytime(date: Date, timeZone: string): boolean {
  const hour = parseInt(
    date.toLocaleString('en-US', { timeZone, hour: 'numeric', hour12: false })
  );
  return hour >= 6 && hour < 18;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    // Set initial time
    setCurrentTime(new Date());
    
    // Update every minute
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const nyTime = currentTime ? formatTimeForZone(currentTime, 'America/New_York') : '--:--';
  const istTime = currentTime ? formatTimeForZone(currentTime, 'Asia/Kolkata') : '--:--';
  const isNyDaytime = currentTime ? isDaytime(currentTime, 'America/New_York') : true;
  const isIstDaytime = currentTime ? isDaytime(currentTime, 'Asia/Kolkata') : true;

  return (
    <aside className="w-64 bg-whatsapp-dark-teal border-r border-whatsapp-dark-teal/30 flex flex-col shadow-lg h-screen sticky top-0">
      {/* Logo / Brand */}
      <div className="p-6 border-b border-whatsapp-teal/30 flex-shrink-0">
        <h1 className="text-xl font-bold text-white">
          WhatsApp Automation
        </h1>
        <p className="text-xs text-whatsapp-light-green mt-1">Schedule & Manage Posts</p>
      </div>

      {/* Navigation - scrollable if needed */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg
                transition-all duration-200
                ${isActive 
                  ? 'bg-whatsapp-green text-white shadow-md' 
                  : 'text-whatsapp-light-green hover:bg-whatsapp-teal/50 hover:text-white'
                }
              `}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Time Display - Fixed at bottom */}
      <div className="px-4 pb-2 flex-shrink-0">
        <div className="bg-whatsapp-teal/30 rounded-lg p-3 space-y-2">
          {/* New York Time */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isNyDaytime ? (
                <Sun size={16} className="text-amber-400" />
              ) : (
                <Moon size={16} className="text-blue-300" />
              )}
              <span className="text-xs text-whatsapp-light-green/80">NY</span>
            </div>
            <span className="text-sm font-mono font-medium text-white">{nyTime}</span>
          </div>
          
          {/* IST Time */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isIstDaytime ? (
                <Sun size={16} className="text-amber-400" />
              ) : (
                <Moon size={16} className="text-blue-300" />
              )}
              <span className="text-xs text-whatsapp-light-green/80">IST</span>
            </div>
            <span className="text-sm font-mono font-medium text-white">{istTime}</span>
          </div>
        </div>
      </div>

      {/* Footer - Fixed at bottom */}
      <div className="p-4 border-t border-whatsapp-teal/30 flex-shrink-0">
        <div className="text-xs text-whatsapp-light-green/70 text-center">
          © 2025 WhatsApp Automation
        </div>
      </div>
    </aside>
  );
}
