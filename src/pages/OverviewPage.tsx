import React from 'react';
import { Activity, Bell, Cpu, Database } from 'lucide-react';
import type { TelemetryStore } from '../hooks/useTelemetryStore';
import type { PageId } from '../types/iot';
import { SensorCard } from '../components/SensorCard';
import { RealTimeChart } from '../components/RealTimeChart';
import { DeviceStatus } from '../components/DeviceStatus';
import { AlertPanel } from '../components/AlertPanel';
import { DataSourceStatus } from '../components/DataSourceStatus';

interface OverviewPageProps {
  store: TelemetryStore;
  onNavigate: (page: PageId) => void;
  onSelectDevice: (deviceId: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  store,
  onNavigate,
  onSelectDevice,
}) => {
  const firebaseSensors = store.sensors.filter((s) => s.source !== 'thingspeak');
  const thingSpeakSensors = store.sensors.filter((s) => s.source === 'thingspeak');
  const onlineDevices = store.devices.filter((d) => d.connectionStatus === 'online').length;
  const activeAlerts = store.alerts.filter((a) => !a.acknowledged).length;

  const connectedSourcesCount =
    (store.firebaseStatus === 'connected' ? 1 : 0) +
    (store.thingSpeakStatus === 'connected' ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-5 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Connected Sources</p>
            <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {connectedSourcesCount} / 2
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-5 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Sensors</p>
            <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {store.sensors.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-5 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Devices Online</p>
            <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {onlineDevices} / {store.devices.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-5 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Unacknowledged Alerts</p>
            <p
              className={`font-mono tabular-nums text-2xl font-semibold ${
                activeAlerts > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {activeAlerts}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Bell className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* Data Source Health */}
      <DataSourceStatus
        firebaseStatus={store.firebaseStatus}
        firebaseMessage={store.firebaseMessage}
        firebaseMode={store.config.firebase.mode}
        firebaseLastSyncAt={store.firebaseLastSyncAt}
        thingSpeakStatus={store.thingSpeakStatus}
        thingSpeakMessage={store.thingSpeakMessage}
        thingSpeakChannel={store.thingSpeakChannel}
        thingSpeakLastSyncAt={store.thingSpeakLastSyncAt}
        thingSpeakLatencyMs={store.thingSpeakLatencyMs}
        timestampFormat={store.config.settings.timestampFormat}
        onConfigureSources={() => onNavigate('sources')}
      />

      {/* Primary Source: Firebase Sensor Overview */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
              Firebase Telemetry — Primary Source
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real-time {store.config.firebase.mode === 'rtdb' ? 'Realtime Database' : 'Cloud Firestore'} sensor readings
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('sources')}
            className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap"
          >
            Configure Firebase Path
          </button>
        </div>

        {firebaseSensors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700/80 bg-white/60 dark:bg-[#111827]/60 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {store.firebaseStatus === 'disconnected'
                  ? 'Sign in with Google to stream protected Firestore devices'
                  : 'No Firebase sensor fields discovered yet'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                {store.firebaseMessage} No simulated Firebase readings are generated. Configure your Firestore collection path or Realtime Database URL in Data Sources.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!store.user && store.config.firebase.mode === 'firestore' && (
                <button
                  type="button"
                  onClick={() => store.signInWithGoogle()}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors whitespace-nowrap"
                >
                  Sign In with Google
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigate('sources')}
                className="px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Open Data Sources
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {firebaseSensors.map((sensor) => (
              <SensorCard
                key={sensor.id}
                sensor={sensor}
                nowMs={store.nowMs}
                timestampFormat={store.config.settings.timestampFormat}
                onSelect={() => onSelectDevice(sensor.deviceId)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Secondary Source: ThingSpeak Sensor Overview */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
              ThingSpeak Telemetry — Secondary Source
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {store.thingSpeakChannel
                ? `Channel ${store.thingSpeakChannel.id} · ${store.thingSpeakChannel.name} · Entry #${store.thingSpeakChannel.lastEntryId ?? '—'}`
                : 'Dynamically mapped from ThingSpeak feeds API'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('sources')}
            className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap"
          >
            Assign Units & Labels
          </button>
        </div>

        {thingSpeakSensors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700/80 bg-white/60 dark:bg-[#111827]/60 p-6 text-xs text-slate-500 dark:text-slate-400">
            {store.thingSpeakStatus === 'error'
              ? `ThingSpeak Error: ${store.thingSpeakMessage}`
              : 'Waiting for ThingSpeak channel feed response...'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {thingSpeakSensors.map((sensor) => (
              <SensorCard
                key={sensor.id}
                sensor={sensor}
                nowMs={store.nowMs}
                timestampFormat={store.config.settings.timestampFormat}
                onSelect={() => onSelectDevice(sensor.deviceId)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Real-Time Multi-Sensor Chart */}
      <RealTimeChart
        readings={store.readings}
        sensors={store.sensors}
        nowMs={store.nowMs}
        timestampFormat={store.config.settings.timestampFormat}
        title="Multi-Sensor Historical & Live Comparison"
        initialRange="24h"
      />

      {/* Device Status & Active Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
              Monitored Devices
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('devices')}
              className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
            >
              Manage Devices
            </button>
          </div>
          <DeviceStatus
            devices={store.devices}
            nowMs={store.nowMs}
            timestampFormat={store.config.settings.timestampFormat}
            onSelectDevice={onSelectDevice}
          />
        </div>

        <AlertPanel
          alerts={store.alerts}
          rules={store.config.alertRules}
          sensors={store.sensors}
          timestampFormat={store.config.settings.timestampFormat}
          compact
          onAcknowledge={store.acknowledgeAlert}
          onAcknowledgeAll={store.acknowledgeAllAlerts}
          onSaveRule={store.addOrUpdateAlertRule}
          onDeleteRule={store.deleteAlertRule}
        />
      </div>
    </div>
  );
};
