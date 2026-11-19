import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download } from 'lucide-react';
import type {
  MonitoredDevice,
  NormalizedReading,
  SensorSummary,
  TimeRangeKey,
  TimestampFormat,
} from '../types/iot';
import {
  computeAnalytics,
  downloadCsvFile,
  filterReadingsByRange,
  formatTimestamp,
} from '../utils/telemetry';

interface AnalyticsPanelProps {
  readings: NormalizedReading[];
  sensors: SensorSummary[];
  devices: MonitoredDevice[];
  nowMs: number;
  timestampFormat: TimestampFormat;
}

const RANGES: { key: TimeRangeKey; label: string }[] = [
  { key: '1h', label: 'Last 1h' },
  { key: '6h', label: 'Last 6h' },
  { key: '24h', label: 'Last 24h' },
  { key: '7d', label: 'Last 7d' },
  { key: 'custom', label: 'Custom' },
];

function fmt(v: number | null, digits = 2): string {
  if (v === null || !Number.isFinite(v)) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(digits);
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  readings,
  sensors,
  devices,
  nowMs,
  timestampFormat,
}) => {
  const [range, setRange] = useState<TimeRangeKey>('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const filteredReadings = useMemo(
    () => filterReadingsByRange(readings, range, customStart, customEnd, nowMs),
    [readings, range, customStart, customEnd, nowMs],
  );

  const stats = useMemo(
    () => computeAnalytics(filteredReadings, sensors, devices),
    [filteredReadings, sensors, devices],
  );

  const overallAvailability = useMemo(() => {
    const valid = stats.filter((s) => s.availabilityPct !== null);
    if (valid.length === 0) return null;
    const avg = valid.reduce((acc, s) => acc + (s.availabilityPct ?? 0), 0) / valid.length;
    return Number(avg.toFixed(2));
  }, [stats]);

  const chartData = useMemo(
    () =>
      stats
        .filter((s) => s.avgValue !== null)
        .map((s) => ({
          name: `${s.label} (${s.source === 'thingspeak' ? 'TS' : 'FB'})`,
          min: s.minValue,
          avg: s.avgValue !== null ? Number(s.avgValue.toFixed(2)) : null,
          max: s.maxValue,
        })),
    [stats],
  );

  const handleExportSummaryCsv = () => {
    const headers = [
      'Sensor',
      'Field Key',
      'Data Source',
      'Device',
      'Unit',
      'Current',
      'Average',
      'Min',
      'Max',
      'Std Dev',
      'Samples',
      'Missing',
      'Availability (%)',
      'Heartbeat Uptime (%)',
    ];
    const rows = stats.map((s) => [
      s.label,
      s.fieldKey,
      s.sourceLabel,
      s.deviceName,
      s.unit,
      s.currentValue ?? '',
      s.avgValue !== null ? s.avgValue.toFixed(4) : '',
      s.minValue ?? '',
      s.maxValue ?? '',
      s.stdDev !== null ? s.stdDev.toFixed(4) : '',
      s.sampleCount,
      s.missingCount,
      s.availabilityPct ?? '',
      s.uptimePct ?? 'Insufficient heartbeat data',
    ]);
    downloadCsvFile(`iot-analytics-summary-${range}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const handleExportSeriesCsv = () => {
    const fieldKeys = Array.from(new Set(sensors.map((s) => s.fieldKey)));
    const headers = ['Timestamp', 'Source', 'Device ID', 'Device Name', 'Entry ID', ...fieldKeys];
    const rows = filteredReadings.map((r) => [
      formatTimestamp(r.timestamp, timestampFormat),
      r.sourceLabel,
      r.deviceId,
      r.deviceName,
      r.entryId ?? '',
      ...fieldKeys.map((k) => (r.values[k] !== null && r.values[k] !== undefined ? r.values[k] : '')),
    ]);
    downloadCsvFile(`iot-telemetry-series-${range}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
              Statistical Performance & Availability
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Computed strictly from actual {filteredReadings.length} readings in window ·{' '}
              Availability: {overallAvailability !== null ? `${overallAvailability}%` : '—'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    range === r.key
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleExportSummaryCsv}
              disabled={stats.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export Summary CSV
            </button>

            <button
              type="button"
              onClick={handleExportSeriesCsv}
              disabled={filteredReadings.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export Series CSV
            </button>
          </div>
        </div>

        {range === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span>From</span>
              <input
                type="datetime-local"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs"
              />
            </label>
            <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span>To</span>
              <input
                type="datetime-local"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs"
              />
            </label>
          </div>
        )}

        {stats.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-500 dark:text-slate-400">
            No sensor statistics available yet. Connect a data source or broaden the date filter.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Sensor</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4 text-right">Current</th>
                  <th className="py-3 px-4 text-right">Average</th>
                  <th className="py-3 px-4 text-right">Min</th>
                  <th className="py-3 px-4 text-right">Max</th>
                  <th className="py-3 px-4 text-right">Std Dev</th>
                  <th className="py-3 px-4 text-right">Availability</th>
                  <th className="py-3 px-4 text-right">Uptime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {stats.map((s) => (
                  <tr key={s.sensorId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {s.label} {s.unit ? `(${s.unit})` : ''}
                      </div>
                      <div className="font-mono text-slate-400 dark:text-slate-500">
                        {s.validCount}/{s.sampleCount} valid samples
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {s.sourceLabel}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {fmt(s.currentValue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                      {fmt(s.avgValue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-sky-600 dark:text-sky-400">
                      {fmt(s.minValue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400">
                      {fmt(s.maxValue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {fmt(s.stdDev)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                      {s.availabilityPct !== null ? `${s.availabilityPct}%` : '—'}
                    </td>
                    <td
                      className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200"
                      title={s.uptimeNote}
                    >
                      {s.uptimePct !== null ? `${s.uptimePct}%` : 'Insufficient data'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {chartData.length > 0 && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-5 space-y-4">
          <div>
            <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
              Min / Average / Max Distribution Comparison
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cross-sensor range envelope across {filteredReadings.length} historical samples
            </p>
          </div>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} stroke="#475569" />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} stroke="#475569" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                    color: '#F1F5F9',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="min" name="Minimum" fill="#0EA5E9" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="avg" name="Average" fill="#10B981" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="max" name="Maximum" fill="#F59E0B" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
};
