import React from 'react';
import { ChevronRight, Cpu, Wifi, WifiOff, Clock } from 'lucide-react';
import type { MonitoredDevice, TimestampFormat } from '../types/iot';
import { formatRelativeDuration, formatTimestamp } from '../utils/telemetry';

interface DeviceStatusProps {
  devices: MonitoredDevice[];
  nowMs: number;
  timestampFormat: TimestampFormat;
  onSelectDevice: (deviceId: string) => void;
}

export const DeviceStatus: React.FC<DeviceStatusProps> = ({
  devices,
  nowMs,
  timestampFormat,
  onSelectDevice,
}) => {
  if (devices.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-8 text-center space-y-2">
        <Cpu className="w-8 h-8 text-slate-400 mx-auto" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          No Devices Discovered Yet
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Sign in to access registered Firebase devices or verify your ThingSpeak channel configuration.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
              <th className="py-3 px-4 whitespace-nowrap">Device</th>
              <th className="py-3 px-4 whitespace-nowrap">Data Source</th>
              <th className="py-3 px-4 whitespace-nowrap">Connection</th>
              <th className="py-3 px-4 whitespace-nowrap">Health</th>
              <th className="py-3 px-4 whitespace-nowrap text-right">Sensors</th>
              <th className="py-3 px-4 whitespace-nowrap">Last Communication</th>
              <th className="py-3 px-4 whitespace-nowrap text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
            {devices.map((device) => {
              const connColor =
                device.connectionStatus === 'online'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : device.connectionStatus === 'offline'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-amber-600 dark:text-amber-400';

              const connLabel =
                device.connectionStatus === 'online'
                  ? 'Online'
                  : device.connectionStatus === 'offline'
                    ? 'Offline (Timeout)'
                    : 'Awaiting Data';

              const healthColor =
                device.healthStatus === 'healthy'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : device.healthStatus === 'warning'
                    ? 'text-amber-600 dark:text-amber-400'
                    : device.healthStatus === 'critical'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-slate-500 dark:text-slate-400';

              const healthLabel =
                device.healthStatus === 'healthy'
                  ? 'Normal'
                  : device.healthStatus === 'warning'
                    ? 'Warning'
                    : device.healthStatus === 'critical'
                      ? 'Critical'
                      : 'Unknown';

              return (
                <tr
                  key={device.id}
                  onClick={() => onSelectDevice(device.id)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{device.name}</div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">{device.id}</div>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    <div>{device.sourceLabel}</div>
                    <div className="font-mono text-slate-400 dark:text-slate-500 truncate max-w-[200px]">
                      {device.pathOrEndpoint}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${connColor}`}>
                      {device.connectionStatus === 'online' ? (
                        <Wifi className="w-3.5 h-3.5" />
                      ) : device.connectionStatus === 'offline' ? (
                        <WifiOff className="w-3.5 h-3.5" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                      {connLabel}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className={`text-xs font-medium ${healthColor}`}>{healthLabel}</span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                    {device.sensorCount}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    <div>{formatRelativeDuration(device.lastCommunicationMs, nowMs)}</div>
                    <div className="text-slate-400 dark:text-slate-500">
                      {formatTimestamp(device.lastCommunicationAt, timestampFormat)}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDevice(device.id);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap"
                    >
                      Details
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
