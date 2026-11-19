/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardLayout } from './components/DashboardLayout';
import { SensorCard } from './components/SensorCard';
import { RealTimeChart } from './components/RealTimeChart';
import { HistoricalDataTable } from './components/HistoricalDataTable';
import { DeviceStatus } from './components/DeviceStatus';
import { AlertPanel } from './components/AlertPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { OverviewPage } from './pages/OverviewPage';
import { DeviceDetailsPage } from './pages/DeviceDetailsPage';
import { DataSourcesPage } from './pages/DataSourcesPage';
import { SettingsPage } from './pages/SettingsPage';
import { useTelemetryStore } from './hooks/useTelemetryStore';
import type { PageId } from './types/iot';

function IoTDashboardApp() {
  const store = useTelemetryStore();
  const [activePage, setActivePage] = useState<PageId>('overview');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const selectedDevice = store.devices.find((d) => d.id === selectedDeviceId) ?? null;
  const unacknowledgedCount = store.alerts.filter((a) => !a.acknowledged).length;

  const handleSelectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setActivePage('device-details');
  };

  return (
    <DashboardLayout
      activePage={activePage}
      onNavigate={setActivePage}
      selectedDeviceName={selectedDevice?.name ?? null}
      nowMs={store.nowMs}
      timestampFormat={store.config.settings.timestampFormat}
      firebaseStatus={store.firebaseStatus}
      thingSpeakStatus={store.thingSpeakStatus}
      lastSyncAt={store.lastSyncAt}
      theme={store.config.settings.theme}
      isRefreshing={store.isRefreshing}
      unacknowledgedAlertCount={unacknowledgedCount}
      user={store.user}
      onSignIn={() => {
        store.signInWithGoogle().catch((err) => {
          console.error('Google sign-in failed:', err);
        });
      }}
      onSignOut={() => {
        store.signOutOperator().catch((err) => {
          console.error('Sign-out failed:', err);
        });
      }}
      onToggleTheme={store.toggleTheme}
      onRefresh={store.refreshAll}
    >
      {activePage === 'overview' && (
        <OverviewPage
          store={store}
          onNavigate={setActivePage}
          onSelectDevice={handleSelectDevice}
        />
      )}

      {activePage === 'live' && (
        <div className="space-y-6">
          <RealTimeChart
            readings={store.readings}
            sensors={store.sensors}
            nowMs={store.nowMs}
            timestampFormat={store.config.settings.timestampFormat}
            title="Live Multi-Sensor Telemetry Stream"
            initialRange="24h"
            height={420}
          />
          <section className="space-y-3">
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
              Live Sensor Channels ({store.sensors.length})
            </h2>
            {store.sensors.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No active sensor fields available yet. Check Data Source Configuration.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {store.sensors.map((sensor) => (
                  <SensorCard
                    key={sensor.id}
                    sensor={sensor}
                    nowMs={store.nowMs}
                    timestampFormat={store.config.settings.timestampFormat}
                    onSelect={() => handleSelectDevice(sensor.deviceId)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {activePage === 'history' && (
        <HistoricalDataTable
          readings={store.readings}
          sensors={store.sensors}
          timestampFormat={store.config.settings.timestampFormat}
        />
      )}

      {activePage === 'devices' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
                Registered & Discovered Devices
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Online status requires a heartbeat within the configured timeout window. Select any device for full telemetry.
              </p>
            </div>
          </div>
          <DeviceStatus
            devices={store.devices}
            nowMs={store.nowMs}
            timestampFormat={store.config.settings.timestampFormat}
            onSelectDevice={handleSelectDevice}
          />
        </div>
      )}

      {activePage === 'device-details' && selectedDeviceId && (
        <DeviceDetailsPage
          deviceId={selectedDeviceId}
          store={store}
          onBack={() => setActivePage('devices')}
        />
      )}

      {activePage === 'alerts' && (
        <AlertPanel
          alerts={store.alerts}
          rules={store.config.alertRules}
          sensors={store.sensors}
          timestampFormat={store.config.settings.timestampFormat}
          onAcknowledge={store.acknowledgeAlert}
          onAcknowledgeAll={store.acknowledgeAllAlerts}
          onSaveRule={store.addOrUpdateAlertRule}
          onDeleteRule={store.deleteAlertRule}
        />
      )}

      {activePage === 'analytics' && (
        <AnalyticsPanel
          readings={store.readings}
          sensors={store.sensors}
          devices={store.devices}
          nowMs={store.nowMs}
          timestampFormat={store.config.settings.timestampFormat}
        />
      )}

      {activePage === 'sources' && <DataSourcesPage store={store} />}

      {activePage === 'settings' && <SettingsPage store={store} />}
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <IoTDashboardApp />
    </ErrorBoundary>
  );
}
