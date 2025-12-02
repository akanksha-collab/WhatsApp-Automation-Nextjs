'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Calendar as CalendarIcon, 
  Settings 
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/entities', label: 'Entities', icon: Users },
  { path: '/templates', label: 'Templates', icon: FileText },
  { path: '/calendar', label: 'Calendar', icon: CalendarIcon },
  { path: '/schedule-settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-whatsapp-dark-teal border-r border-whatsapp-dark-teal/30 flex flex-col shadow-lg">
      {/* Logo / Brand */}
      <div className="p-6 border-b border-whatsapp-teal/30">
        <h1 className="text-xl font-bold text-white">
          WhatsApp Automation
        </h1>
        <p className="text-xs text-whatsapp-light-green mt-1">Schedule & Manage Posts</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
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

      {/* Footer */}
      <div className="p-4 border-t border-whatsapp-teal/30">
        <div className="text-xs text-whatsapp-light-green/70 text-center">
          © 2025 WhatsApp Automation
        </div>
      </div>
    </aside>
  );
}

