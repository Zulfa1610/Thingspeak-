import React from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Droplets,
  Gauge,
  Minus,
  ShieldAlert,
  Sun,
  Thermometer,
  Waves,
} from 'lucide-react';
import type { SensorSummary, TimestampFormat } from '../types/iot';
import { formatRelativeDuration, formatTimestamp } from '../utils/telemetry';

interface SensorCardProps {
  sensor: SensorSummary;
  nowMs: number;
  timestampFormat: TimestampFormat;
  onSelect?: () => void;
}

function getSensorIcon(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes('temp')) return Thermometer;
  if (lower.includes('humid') || lower.includes('moist')) return Droplets;
  if (lower.includes('light') || lower.includes('lux') || lower.includes('solar')) return Sun;
  if (lower.includes('water') || lower.includes('level') || lower.includes('flow')) return Waves;
  if (lower.includes('alert') || lower.includes('alarm') || lower.includes('fault')) return ShieldAlert;
  if (lower.includes('press') || lower.includes('volt') || lower.includes('watt')) return Gauge;
  return Activity;
}

function formatMetricNumber(val: number | null): string {
  if (val === null || !Number.isFinite(val)) return '—';
  if (Number.isInteger(val)) return val.toString();
  if (Math.abs(val) >= 100) return val.toFixed(1);
  return val.toFixed(2);
}

export const SensorCard: React.FC<SensorCardProps> = ({
  sensor,
  nowMs,
  timestampFormat,
  onSelect,
}) => {
  const Icon = getSensorIcon(sensor.label);

  const statusMeta =
    sensor.status === 'online'
      ? { label: 'Online', className: 'text-emerald-600 dark:text-emerald-400' }
      : sensor.status === 'offline'
        ? { label: 'Offline (Stale)', className: 'text-red-600 dark:text-red-400' }
        : { label: 'Missing Data', className: 'text-amber-600 dark:text-amber-400' };

  return (
    <div
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      className={`rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-5 flex flex-col justify-between gap-4 transition-colors ${
        onSelect ? 'cursor-pointer hover:border-sky-400/60 dark:hover:border-sky-500/40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="truncate">{sensor.sourceLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate font-mono">{sensor.fieldKey}</span>
          </div>
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100 truncate">
            {sensor.label}
          </h3>
        </div>

        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="font-mono tabular-nums text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {formatMetricNumber(sensor.currentValue)}
          </span>
          {sensor.unit && (
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {sensor.unit}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs font-mono tabular-nums shrink-0">
          {sensor.trend === 'up' && (
            <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="w-3.5 h-3.5" />
              +{formatMetricNumber(sensor.delta)}
            </span>
          )}
          {sensor.trend === 'down' && (
            <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
              <ArrowDownRight className="w-3.5 h-3.5" />
              {formatMetricNumber(sensor.delta)}
            </span>
          )}
          {sensor.trend === 'flat' && (
            <span className="inline-flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
              <Minus className="w-3.5 h-3.5" />
              0
            </span>
          )}
          {sensor.trend === 'missing' && (
            <span className="text-slate-400 dark:text-slate-500">No delta</span>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`font-medium whitespace-nowrap ${statusMeta.className}`}>
            {statusMeta.label}
          </span>
          <span className="text-slate-400 dark:text-slate-600" aria-hidden="true">·</span>
          <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
            prev {formatMetricNumber(sensor.previousValue)}
          </span>
        </div>

        <span
          className="text-slate-500 dark:text-slate-400 font-mono tabular-nums whitespace-nowrap shrink-0"
          title={formatTimestamp(sensor.lastUpdated, timestampFormat)}
        >
          {formatRelativeDuration(sensor.lastUpdatedMs, nowMs)}
        </span>
      </div>
    </div>
  );
};
