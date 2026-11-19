import React, { useMemo, useState } from 'react';
import { ArrowDownUp, Download, Search } from 'lucide-react';
import type {
  DataSourceType,
  NormalizedReading,
  SensorSummary,
  TimestampFormat,
} from '../types/iot';
import { downloadCsvFile, formatTimestamp } from '../utils/telemetry';

interface HistoricalDataTableProps {
  readings: NormalizedReading[];
  sensors: SensorSummary[];
  timestampFormat: TimestampFormat;
}

const PAGE_SIZE = 25;

export const HistoricalDataTable: React.FC<HistoricalDataTableProps> = ({
  readings,
  sensors,
  timestampFormat,
}) => {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | DataSourceType>('all');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);

  const columns = useMemo(() => {
    const map = new Map<string, { fieldKey: string; label: string; unit: string }>();
    for (const s of sensors) {
      if (!map.has(s.fieldKey)) {
        map.set(s.fieldKey, { fieldKey: s.fieldKey, label: s.label, unit: s.unit });
      }
    }
    for (const r of readings) {
      for (const k of Object.keys(r.values)) {
        if (!map.has(k)) {
          map.set(k, { fieldKey: k, label: k, unit: '' });
        }
      }
    }
    return Array.from(map.values());
  }, [sensors, readings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = readings.filter((r) => {
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        r.deviceName.toLowerCase().includes(q) ||
        r.deviceId.toLowerCase().includes(q) ||
        r.sourceLabel.toLowerCase().includes(q) ||
        String(r.entryId ?? '').toLowerCase().includes(q) ||
        r.timestamp.toLowerCase().includes(q)
      );
    });
    list.sort((a, b) => (sortDesc ? b.timestampMs - a.timestampMs : a.timestampMs - b.timestampMs));
    return list;
  }, [readings, sourceFilter, search, sortDesc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleExportCsv = () => {
    const headers = [
      'Timestamp',
      'Source',
      'Device',
      'Entry ID',
      ...columns.map((c) => (c.unit ? `${c.label} (${c.unit})` : c.label)),
    ];
    const rows = filtered.map((r) => [
      formatTimestamp(r.timestamp, timestampFormat),
      r.sourceLabel,
      r.deviceName,
      r.entryId ?? '',
      ...columns.map((c) => (r.values[c.fieldKey] !== null && r.values[c.fieldKey] !== undefined ? r.values[c.fieldKey] : '')),
    ]);
    downloadCsvFile(`iot-historical-log-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-5 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
            Historical Telemetry Records
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {filtered.length} matching records · Missing values shown as —
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Filter device, entry ID, timestamp..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-60"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value as 'all' | DataSourceType);
              setPage(1);
            }}
            aria-label="Filter by data source"
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          >
            <option value="all">All Sources</option>
            <option value="thingspeak">ThingSpeak API</option>
            <option value="firebase-firestore">Firebase Firestore</option>
            <option value="firebase-rtdb">Firebase RTDB</option>
          </select>

          <button
            type="button"
            onClick={() => setSortDesc((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <ArrowDownUp className="w-3.5 h-3.5" />
            {sortDesc ? 'Newest First' : 'Oldest First'}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {pageRows.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-500 dark:text-slate-400">
          No telemetry records match the current filter.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4 whitespace-nowrap">Timestamp</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Source</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Device</th>
                  <th className="py-2.5 px-4 whitespace-nowrap text-right">Entry ID</th>
                  {columns.map((col) => (
                    <th key={col.fieldKey} className="py-2.5 px-4 whitespace-nowrap text-right">
                      {col.label}
                      {col.unit ? ` (${col.unit})` : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {pageRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatTimestamp(row.timestamp, timestampFormat)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {row.sourceLabel}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {row.deviceName}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-right text-slate-500 dark:text-slate-400">
                      {row.entryId ?? '—'}
                    </td>
                    {columns.map((col) => {
                      const val = row.values[col.fieldKey];
                      return (
                        <td
                          key={col.fieldKey}
                          className={`py-2.5 px-4 font-mono tabular-nums text-right ${
                            val === null || val === undefined
                              ? 'text-slate-400 dark:text-slate-600'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {val !== null && val !== undefined ? val : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums">
              Page {safePage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
