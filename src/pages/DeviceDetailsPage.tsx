import React, { useMemo } from 'react';
import { ArrowLeft, Cpu, Wifi, WifiOff, Clock } from 'lucide-react';
import type { TelemetryStore } from '../hooks/useTelemetryStore';
import { SensorCard } from '../components/SensorCard';
import { RealTimeChart } from '../components/RealTimeChart';
import { HistoricalDataTable } from '../components/HistoricalDataTable';
import { AlertPanel } from '../components/AlertPanel';
import { formatRelativeDuration, formatTimestamp } from '../utils/telemetry';

interface DeviceDetailsPageProps {
  deviceId: string;
  store: TelemetryStore;
  onBack: () => void;
}

export const DeviceDetailsPage: React.FC<DeviceDetailsPageProps> = ({
  deviceId,
  store,
  onBack,
}) => {
  const device = store.devices.find((d) => d.id === deviceId) ?? null;

  const deviceSensors = useMemo(
    () => store.sensors.filter((s) => s.deviceId === deviceId),
    [store.sensors, deviceId],
  );

  const deviceReadings = useMemo(
    () => store.readings.filter((r) => r.deviceId === deviceId),
    [store.readings, deviceId],
  );

  const deviceAlerts = useMemo(
    () => store.alerts.filter((a) => a.deviceId === deviceId),
    [store.alerts, deviceId],
  );

  if (!device) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Device Management
        </button>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-8 text-center">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            Device "{deviceId}" is not currently loaded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Device Management
        </button>
      </div>

      {/* Device Metadata Summary */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-slate-100">
                {device.name}
              </h2>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                ID: {device.id} · {device.sourceLabel} · {device.pathOrEndpoint}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            {device.connectionStatus === 'online' ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                <Wifi className="w-4 h-4" />
                Online
              </span>
            ) : device.connectionStatus === 'offline' ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-red-600 dark:text-red-400">
                <WifiOff className="w-4 h-4" />
                Offline (Heartbeat Timeout)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" />
                Awaiting Data
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <div>
            <p className="text-slate-500 dark:text-slate-400">Last Communication</p>
            <p className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 mt-1">
              {formatRelativeDuration(device.lastCommunicationMs, store.nowMs)}
            </p>
            <p className="font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
              {formatTimestamp(device.lastCommunicationAt, store.config.settings.timestampFormat)}
            </p>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">Available Sensors</p>
            <p className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 mt-1">
              {device.sensorCount} active fields
            </p>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">Heartbeat Timeout</p>
            <p className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 mt-1">
              {device.heartbeatTimeoutSec} seconds
            </p>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">Health Status</p>
            <p className="font-medium capitalize text-slate-900 dark:text-slate-100 mt-1">
              {device.healthStatus}
            </p>
          </div>
        </div>
      </section>

      {/* Associated Sensor Cards */}
      <section className="space-y-3">
        <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
          Associated Sensors ({deviceSensors.length})
        </h3>
        {deviceSensors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-xs text-slate-500 dark:text-slate-400">
            No sensor readings found for this device yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {deviceSensors.map((sensor) => (
              <SensorCard
                key={sensor.id}
                sensor={sensor}
                nowMs={store.nowMs}
                timestampFormat={store.config.settings.timestampFormat}
              />
            ))}
          </div>
        )}
      </section>

      {/* Device Real-Time & Historical Chart */}
      <RealTimeChart
        readings={deviceReadings}
        sensors={deviceSensors}
        nowMs={store.nowMs}
        timestampFormat={store.config.settings.timestampFormat}
        title={`${device.name} — Telemetry History`}
        initialRange="24h"
      />

      {/* Device Alerts */}
      <AlertPanel
        alerts={deviceAlerts}
        rules={store.config.alertRules}
        sensors={deviceSensors}
        timestampFormat={store.config.settings.timestampFormat}
        compact
        onAcknowledge={store.acknowledgeAlert}
        onAcknowledgeAll={store.acknowledgeAllAlerts}
        onSaveRule={store.addOrUpdateAlertRule}
        onDeleteRule={store.deleteAlertRule}
      />

      {/* Device Historical Log */}
      <HistoricalDataTable
        readings={deviceReadings}
        sensors={deviceSensors}
        timestampFormat={store.config.settings.timestampFormat}
      />
    </div>
  );
};
