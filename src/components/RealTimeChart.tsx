import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  NormalizedReading,
  SensorSummary,
  TimeRangeKey,
  TimestampFormat,
} from '../types/iot';
import { filterReadingsByRange, formatShortTime, formatTimestamp } from '../utils/telemetry';

interface RealTimeChartProps {
  readings: NormalizedReading[];
  sensors: SensorSummary[];
  nowMs: number;
  timestampFormat: TimestampFormat;
  title?: string;
  initialRange?: TimeRangeKey;
  height?: number;
}

const CHART_PALETTE = [
  '#0EA5E9', // Sky Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#84CC16', // Lime
];

const TIME_RANGES: { key: TimeRangeKey; label: string }[] = [
  { key: '1h', label: 'Last 1h' },
  { key: '6h', label: 'Last 6h' },
  { key: '24h', label: 'Last 24h' },
  { key: '7d', label: 'Last 7d' },
  { key: 'custom', label: 'Custom' },
];

export const RealTimeChart: React.FC<RealTimeChartProps> = ({
  readings,
  sensors,
  nowMs,
  timestampFormat,
  title = 'Telemetry Time-Series',
  initialRange = '24h',
  height = 360,
}) => {
  const [chartType, setChartType] = useState<'line' | 'area'>('area');
  const [range, setRange] = useState<TimeRangeKey>(initialRange);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedSensorIds, setSelectedSensorIds] = useState<string[]>([]);

  // Initialize selected sensors when sensors load (up to 4 by default)
  useEffect(() => {
    if (sensors.length > 0 && selectedSensorIds.length === 0) {
      setSelectedSensorIds(sensors.slice(0, 4).map((s) => s.id));
    } else if (selectedSensorIds.length > 0) {
      const validIds = new Set(sensors.map((s) => s.id));
      const stillValid = selectedSensorIds.filter((id) => validIds.has(id));
      if (stillValid.length === 0 && sensors.length > 0) {
        setSelectedSensorIds(sensors.slice(0, 4).map((s) => s.id));
      }
    }
  }, [sensors, selectedSensorIds]);

  const toggleSensor = (sensorId: string) => {
    setSelectedSensorIds((prev) =>
      prev.includes(sensorId)
        ? prev.length > 1
          ? prev.filter((id) => id !== sensorId)
          : prev
        : [...prev, sensorId],
    );
  };

  const filteredReadings = useMemo(
    () => filterReadingsByRange(readings, range, customStart, customEnd, nowMs),
    [readings, range, customStart, customEnd, nowMs],
  );

  const activeSensors = useMemo(
    () => sensors.filter((s) => selectedSensorIds.includes(s.id)),
    [sensors, selectedSensorIds],
  );

  // Merge timestamps across selected devices while keeping source-specific keys isolated
  const chartData = useMemo(() => {
    if (filteredReadings.length === 0 || activeSensors.length === 0) return [];
    const activeDeviceIds = new Set(activeSensors.map((s) => s.deviceId));
    const relevant = filteredReadings.filter((r) => activeDeviceIds.has(r.deviceId));

    const rowMap = new Map<number, Record<string, string | number | null>>();
    for (const r of relevant) {
      let row = rowMap.get(r.timestampMs);
      if (!row) {
        row = {
          timestampMs: r.timestampMs,
          timeLabel: formatShortTime(r.timestampMs, timestampFormat),
          fullTime: formatTimestamp(r.timestampMs, timestampFormat),
        };
        rowMap.set(r.timestampMs, row);
      }
      for (const s of activeSensors) {
        if (s.deviceId === r.deviceId) {
          row[s.id] = r.values[s.fieldKey] ?? null;
        }
      }
    }

    return Array.from(rowMap.values()).sort(
      (a, b) => Number(a.timestampMs) - Number(b.timestampMs),
    );
  }, [filteredReadings, activeSensors, timestampFormat]);

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-5 space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Source-tagged time-series comparison · {chartData.length} plotted intervals
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70">
            {TIME_RANGES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRange(item.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  range === item.key
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70">
            <button
              type="button"
              onClick={() => setChartType('area')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                chartType === 'area'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Area
            </button>
            <button
              type="button"
              onClick={() => setChartType('line')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                chartType === 'line'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Line
            </button>
          </div>
        </div>
      </div>

      {range === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
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

      {sensors.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {sensors.map((sensor, idx) => {
            const active = selectedSensorIds.includes(sensor.id);
            const color = CHART_PALETTE[idx % CHART_PALETTE.length];
            return (
              <button
                key={sensor.id}
                type="button"
                onClick={() => toggleSensor(sensor.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                    : 'border-slate-200 dark:border-slate-800 bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: active ? color : '#64748b' }}
                  aria-hidden="true"
                />
                <span>{sensor.label}</span>
                <span className="text-slate-400 dark:text-slate-500 font-normal">
                  ({sensor.source === 'thingspeak' ? 'TS' : 'FB'})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {sensors.length === 0 ? (
        <div className="h-72 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            No sensor streams available to plot
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
            Connect Firebase or ThingSpeak in Data Sources to visualize real-time telemetry trends.
          </p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-72 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-6 gap-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            No readings found inside the selected {range === 'custom' ? 'custom date' : range} window
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
            {readings.length} total readings exist in memory. Expand the time window to view older telemetry.
          </p>
          {range !== '7d' && (
            <button
              type="button"
              onClick={() => setRange('7d')}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors whitespace-nowrap"
            >
              Show Last 7 Days
            </button>
          )}
        </div>
      ) : (
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
                <defs>
                  {activeSensors.map((s, idx) => {
                    const color = CHART_PALETTE[sensors.findIndex((x) => x.id === s.id) % CHART_PALETTE.length];
                    return (
                      <linearGradient key={s.id} id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                <XAxis
                  dataKey="timeLabel"
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  stroke="#475569"
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  stroke="#475569"
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                    color: '#F1F5F9',
                  }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullTime || ''}
                  formatter={(value: unknown, name: unknown) => {
                    const num = typeof value === 'number' ? value.toFixed(2) : '—';
                    return [num, String(name)];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {activeSensors.map((s, idx) => {
                  const color = CHART_PALETTE[sensors.findIndex((x) => x.id === s.id) % CHART_PALETTE.length];
                  return (
                    <Area
                      key={s.id}
                      type="monotone"
                      dataKey={s.id}
                      name={`${s.label}${s.unit ? ` (${s.unit})` : ''} [${s.sourceLabel}]`}
                      stroke={color}
                      strokeWidth={2}
                      fill={`url(#grad-${idx})`}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  );
                })}
                {chartData.length > 10 && (
                  <Brush dataKey="timeLabel" height={24} stroke="#0EA5E9" fill="#0F172A" />
                )}
              </AreaChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                <XAxis
                  dataKey="timeLabel"
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  stroke="#475569"
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  stroke="#475569"
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                    color: '#F1F5F9',
                  }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullTime || ''}
                  formatter={(value: unknown, name: unknown) => {
                    const num = typeof value === 'number' ? value.toFixed(2) : '—';
                    return [num, String(name)];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {activeSensors.map((s) => {
                  const color = CHART_PALETTE[sensors.findIndex((x) => x.id === s.id) % CHART_PALETTE.length];
                  return (
                    <Line
                      key={s.id}
                      type="monotone"
                      dataKey={s.id}
                      name={`${s.label}${s.unit ? ` (${s.unit})` : ''} [${s.sourceLabel}]`}
                      stroke={color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  );
                })}
                {chartData.length > 10 && (
                  <Brush dataKey="timeLabel" height={24} stroke="#0EA5E9" fill="#0F172A" />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};
