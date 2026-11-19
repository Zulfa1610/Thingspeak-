import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import type { ConnectionState, PageId, TimestampFormat } from '../types/iot';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  selectedDeviceName?: string | null;
  nowMs: number;
  timestampFormat: TimestampFormat;
  firebaseStatus: ConnectionState;
  thingSpeakStatus: ConnectionState;
  lastSyncAt: string | null;
  theme: 'dark' | 'light';
  isRefreshing: boolean;
  unacknowledgedAlertCount: number;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onToggleTheme: () => void;
  onRefresh: () => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  activePage,
  onNavigate,
  selectedDeviceName,
  nowMs,
  timestampFormat,
  firebaseStatus,
  thingSpeakStatus,
  lastSyncAt,
  theme,
  isRefreshing,
  unacknowledgedAlertCount,
  user,
  onSignIn,
  onSignOut,
  onToggleTheme,
  onRefresh,
  children,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100">
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        unacknowledgedAlertCount={unacknowledgedAlertCount}
        user={user}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          activePage={activePage}
          selectedDeviceName={selectedDeviceName}
          nowMs={nowMs}
          timestampFormat={timestampFormat}
          firebaseStatus={firebaseStatus}
          thingSpeakStatus={thingSpeakStatus}
          lastSyncAt={lastSyncAt}
          theme={theme}
          isRefreshing={isRefreshing}
          onToggleTheme={onToggleTheme}
          onRefresh={onRefresh}
          onOpenMobileMenu={() => setMobileOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-7 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
