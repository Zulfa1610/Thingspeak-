import React from 'react';
import {
  Activity,
  Bell,
  BarChart3,
  Cpu,
  Database,
  History,
  LayoutDashboard,
  LogIn,
  LogOut,
  Radio,
  Settings,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { PageId } from '../types/iot';

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  unacknowledgedAlertCount: number;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

const NAV_ITEMS: { id: PageId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview Dashboard', icon: LayoutDashboard },
  { id: 'live', label: 'Live Monitoring', icon: Activity },
  { id: 'history', label: 'Historical Data', icon: History },
  { id: 'devices', label: 'Device Management', icon: Cpu },
  { id: 'alerts', label: 'Alerts & Rules', icon: Bell },
  { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { id: 'sources', label: 'Data Sources', icon: Database },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  mobileOpen,
  onCloseMobile,
  unacknowledgedAlertCount,
  user,
  onSignIn,
  onSignOut,
}) => {
  const effectiveActive = activePage === 'device-details' ? 'devices' : activePage;

  const content = (
    <div className="flex flex-col h-full bg-white dark:bg-[#0F172A] border-r border-slate-200 dark:border-slate-800/90 w-64">
      <div className="flex items-center justify-between h-16 px-5 border-b border-slate-200 dark:border-slate-800/90 shrink-0">
        <button
          type="button"
          onClick={() => {
            onNavigate('overview');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-md"
        >
          <div className="w-8 h-8 rounded-lg bg-sky-600 dark:bg-sky-500/15 border border-sky-700/20 dark:border-sky-500/30 flex items-center justify-center text-white dark:text-sky-400 shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            NexusGrid
          </span>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = effectiveActive === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === 'alerts' && unacknowledgedAlertCount > 0 && (
                <span className="font-mono tabular-nums text-xs font-semibold text-red-600 dark:text-red-400 shrink-0">
                  {unacknowledgedAlertCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800/90 space-y-3 shrink-0">
        {user ? (
          <div className="space-y-2.5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                {user.displayName || 'Authenticated Operator'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                {user.email}
              </p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Sign in with Google to stream protected Firestore telemetry.
            </p>
            <button
              type="button"
              onClick={onSignIn}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In with Google
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0">{content}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
};
