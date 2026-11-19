import React from 'react';
import { Cloud, Database } from 'lucide-react';
import type { ConnectionState, ThingSpeakChannelInfo, TimestampFormat } from '../types/iot';
import { provisionedProjectInfo } from '../lib/firebase';
import { formatTimestamp } from '../utils/telemetry';

interface DataSourceStatusProps {
  firebaseStatus: ConnectionState;
  firebaseMessage: string;
  firebaseMode: 'firestore' | 'rtdb';
  firebaseLastSyncAt: string | null;
  thingSpeakStatus: ConnectionState;
  thingSpeakMessage: string;
  thingSpeakChannel: ThingSpeakChannelInfo | null;
  thingSpeakLastSyncAt: string | null;
  thingSpeakLatencyMs: number | null;
  timestampFormat: TimestampFormat;
  onConfigureSources: () => void;
}

function getBadgeStyle(state: ConnectionState) {
  if (state === 'connected') return { label: 'Connected', cls: 'text-emerald-600 dark:text-emerald-400' };
  if (state === 'connecting') return { label: 'Connecting', cls: 'text-amber-600 dark:text-amber-400' };
  if (state === 'error') return { label: 'Error', cls: 'text-red-600 dark:text-red-400' };
  if (state === 'disconnected') return { label: 'Sign-In Required', cls: 'text-amber-600 dark:text-amber-400' };
  return { label: 'Disabled', cls: 'text-slate-500 dark:text-slate-400' };
}

export const DataSourceStatus: React.FC<DataSourceStatusProps> = ({
  firebaseStatus,
  firebaseMessage,
  firebaseMode,
  firebaseLastSyncAt,
  thingSpeakStatus,
  thingSpeakMessage,
  thingSpeakChannel,
  thingSpeakLastSyncAt,
  thingSpeakLatencyMs,
  timestampFormat,
  onConfigureSources,
}) => {
  const fbMeta = getBadgeStyle(firebaseStatus);
  const tsMeta = getBadgeStyle(thingSpeakStatus);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Firebase ({firebaseMode === 'rtdb' ? 'Realtime Database' : 'Cloud Firestore'})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Project: {provisionedProjectInfo.projectId}
              </p>
            </div>
          </div>
          <span className={`text-xs font-semibold whitespace-nowrap ${fbMeta.cls}`}>
            {fbMeta.label}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {firebaseMessage}
        </p>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="font-mono tabular-nums">
            Sync: {firebaseLastSyncAt ? formatTimestamp(firebaseLastSyncAt, timestampFormat) : '—'}
          </span>
          <button
            type="button"
            onClick={onConfigureSources}
            className="text-sky-600 dark:text-sky-400 font-medium hover:underline whitespace-nowrap"
          >
            Configure Path
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                ThingSpeak REST API
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {thingSpeakChannel ? `Channel ${thingSpeakChannel.id} · ${thingSpeakChannel.name}` : 'Channel 3585272'}
              </p>
            </div>
          </div>
          <span className={`text-xs font-semibold whitespace-nowrap ${tsMeta.cls}`}>
            {tsMeta.label}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {thingSpeakMessage}
        </p>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="font-mono tabular-nums">
            Sync: {thingSpeakLastSyncAt ? formatTimestamp(thingSpeakLastSyncAt, timestampFormat) : '—'}
            {thingSpeakLatencyMs !== null ? ` · ${thingSpeakLatencyMs}ms` : ''}
          </span>
          <button
            type="button"
            onClick={onConfigureSources}
            className="text-sky-600 dark:text-sky-400 font-medium hover:underline whitespace-nowrap"
          >
            Configure API
          </button>
        </div>
      </div>
    </div>
  );
};
