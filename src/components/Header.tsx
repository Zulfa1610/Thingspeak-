import React from 'react';
import { Menu, Moon, RefreshCw, Sun } from 'lucide-react';
import type { ConnectionState, PageId, TimestampFormat } from '../types/iot';
import { formatTimestamp } from '../utils/telemetry';

interface HeaderProps {
  activePage: PageId;
  selectedDeviceName?: string | null;
  nowMs: number;
  timestampFormat: TimestampFormat;
  firebaseStatus: ConnectionState;
  thingSpeakStatus: ConnectionState;
  lastSyncAt: string | null;
  theme: 'dark' | 'light';
  isRefreshing: boolean;
  onToggleTheme: () => void;
  onRefresh: () => void;
  onOpenMobileMenu: () => void;
}

const PAGE_TITLES: Record<PageId, string> = {
  overview: 'Operations Overview',
  live: 'Live Sensor Monitoring',
  history: 'Historical Telemetry Log',
  devices: 'Device Management',
  'device-details': 'Device Telemetry Details',
  alerts: 'Alerts & Threshold Rules',
  analytics: 'Analytics & Reports',
  sources: 'Data Source Configuration',
  settings: 'Application Settings',
};

function statusText(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Syncing';
    case 'disconnected':
      return 'Auth Required';
    case 'unconfigured':
      return 'Disabled';
    case 'error':
      return 'Error';
  }
}

function statusDotClass(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return 'bg-emerald-500';
    case 'connecting':
      return 'bg-amber-500';
    case 'disconnected':
    case 'unconfigured':
      return 'bg-slate-400';
    case 'error':
      return 'bg-red-500';
  }
}

export const Header: React.FC<HeaderProps> = ({
  activePage,
  selectedDeviceName,
  nowMs,
  timestampFormat,
  firebaseStatus,
  thingSpeakStatus,
  lastSyncAt,
  theme,
  isRefreshing,
  onToggleTheme,
  onRefresh,
  onOpenMobileMenu,
}) => {
  const title =
    activePage === 'device-details' && selectedDeviceName
      ? `${selectedDeviceName}`
      : PAGE_TITLES[activePage];

  return (
    <header className="sticky top-0 z-30 h-16 px-4 sm:px-6 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800/90 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-slate-100 truncate">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-5 shrink-0">
        <div className="hidden xl:flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className={`w-2 h-2 rounded-full ${statusDotClass(firebaseStatus)}`} aria-hidden="true" />
            <span>Firebase:</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{statusText(firebaseStatus)}</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className={`w-2 h-2 rounded-full ${statusDotClass(thingSpeakStatus)}`} aria-hidden="true" />
            <span>ThingSpeak:</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{statusText(thingSpeakStatus)}</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
          <div className="whitespace-nowrap">
            <span>Last Sync: </span>
            <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
              {lastSyncAt ? formatTimestamp(lastSyncAt, timestampFormat) : 'Pending'}
            </span>
          </div>
        </div>

        <div className="hidden md:block text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
          {formatTimestamp(nowMs, timestampFormat)}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh telemetry data"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
