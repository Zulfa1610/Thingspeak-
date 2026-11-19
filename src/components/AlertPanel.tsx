import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import type {
  AlertEvent,
  AlertRule,
  AlertSeverity,
  DataSourceType,
  SensorSummary,
  TimestampFormat,
} from '../types/iot';
import { formatTimestamp } from '../utils/telemetry';

interface AlertPanelProps {
  alerts: AlertEvent[];
  rules: AlertRule[];
  sensors: SensorSummary[];
  timestampFormat: TimestampFormat;
  compact?: boolean;
  onAcknowledge: (id: string) => void;
  onAcknowledgeAll: () => void;
  onSaveRule: (rule: AlertRule) => void;
  onDeleteRule: (ruleId: string) => void;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({
  alerts,
  rules,
  sensors,
  timestampFormat,
  compact = false,
  onAcknowledge,
  onAcknowledgeAll,
  onSaveRule,
  onDeleteRule,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'all' | AlertSeverity>('all');
  const [showRuleForm, setShowRuleForm] = useState(false);

  // New rule form state
  const [selectedSensorKey, setSelectedSensorKey] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<DataSourceType | 'all'>('all');
  const [minThreshold, setMinThreshold] = useState<string>('');
  const [maxThreshold, setMaxThreshold] = useState<string>('');
  const [anomalySpikePct, setAnomalySpikePct] = useState<string>('');
  const [severity, setSeverity] = useState<'warning' | 'critical'>('warning');
  const [alertOnMissing, setAlertOnMissing] = useState(true);

  const filteredAlerts = alerts.filter((a) =>
    severityFilter === 'all' ? true : a.severity === severityFilter,
  );

  const displayedAlerts = compact ? filteredAlerts.slice(0, 5) : filteredAlerts;

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    const matchedSensor = sensors.find((s) => s.id === selectedSensorKey);
    const fieldKey = matchedSensor ? matchedSensor.fieldKey : selectedSensorKey.trim() || '*';
    const fieldLabel = matchedSensor
      ? matchedSensor.label
      : fieldKey === '*'
        ? 'All Telemetry Fields'
        : fieldKey;

    const minVal = minThreshold.trim() !== '' && Number.isFinite(Number(minThreshold)) ? Number(minThreshold) : null;
    const maxVal = maxThreshold.trim() !== '' && Number.isFinite(Number(maxThreshold)) ? Number(maxThreshold) : null;
    const spikeVal = anomalySpikePct.trim() !== '' && Number.isFinite(Number(anomalySpikePct)) ? Number(anomalySpikePct) : null;

    const newRule: AlertRule = {
      id: `rule-${Date.now()}`,
      source: matchedSensor ? matchedSensor.source : sourceFilter,
      fieldKey,
      fieldLabel,
      minThreshold: minVal,
      maxThreshold: maxVal,
      alertOnMissing,
      alertOnDisconnect: false,
      anomalySpikePct: spikeVal,
      severity,
      enabled: true,
      isDefaultConfig: false,
    };

    onSaveRule(newRule);
    setShowRuleForm(false);
    setMinThreshold('');
    setMaxThreshold('');
    setAnomalySpikePct('');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
              Active Telemetry Alerts
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Evaluated against live Firebase and ThingSpeak readings · {alerts.filter((a) => !a.acknowledged).length} unacknowledged
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!compact && (
              <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70">
                {(['all', 'critical', 'warning'] as const).map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
                      severityFilter === sev
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            )}

            {alerts.some((a) => !a.acknowledged) && (
              <button
                type="button"
                onClick={onAcknowledgeAll}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Acknowledge All
              </button>
            )}
          </div>
        </div>

        {displayedAlerts.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg space-y-1.5">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Status Normal — No Active Alerts
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All monitored streams satisfy configured threshold and heartbeat rules.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {displayedAlerts.map((alert) => {
              const isCritical = alert.severity === 'critical';
              const Icon = isCritical ? AlertCircle : AlertTriangle;
              const sevColor = isCritical
                ? 'text-red-600 dark:text-red-400'
                : 'text-amber-600 dark:text-amber-400';

              return (
                <div
                  key={alert.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    alert.acknowledged ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${sevColor}`} />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`font-semibold uppercase tracking-wide ${sevColor}`}>
                          {alert.severity}
                        </span>
                        <span className="text-slate-400" aria-hidden="true">·</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {alert.deviceName}
                        </span>
                        <span className="text-slate-400" aria-hidden="true">·</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {alert.sourceLabel}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        {alert.message}
                      </p>
                      <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {formatTimestamp(alert.timestamp, timestampFormat)}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {alert.acknowledged ? (
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                        Acknowledged
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAcknowledge(alert.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {!compact && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
                Configurable Threshold & Alert Rules
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Default system rules monitor heartbeat timeouts and missing data. Add custom high/low limits per sensor field below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRuleForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Threshold Rule
            </button>
          </div>

          {showRuleForm && (
            <form
              onSubmit={handleCreateRule}
              className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <label className="space-y-1 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">Target Sensor Field</span>
                <select
                  value={selectedSensorKey}
                  onChange={(e) => setSelectedSensorKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs"
                >
                  <option value="">All Fields (*)</option>
                  {sensors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({s.sourceLabel})
                    </option>
                  ))}
                </select>
              </label>

              {!selectedSensorKey && (
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Data Source Scope</span>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value as DataSourceType | 'all')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs"
                  >
                    <option value="all">All Sources</option>
                    <option value="thingspeak">ThingSpeak API</option>
                    <option value="firebase-firestore">Firebase Firestore</option>
                    <option value="firebase-rtdb">Firebase RTDB</option>
                  </select>
                </label>
              )}

              <label className="space-y-1 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">Low Threshold (Min)</span>
                <input
                  type="number"
                  step="any"
                  placeholder="Optional"
                  value={minThreshold}
                  onChange={(e) => setMinThreshold(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs"
                />
              </label>

              <label className="space-y-1 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">High Threshold (Max)</span>
                <input
                  type="number"
                  step="any"
                  placeholder="Optional"
                  value={maxThreshold}
                  onChange={(e) => setMaxThreshold(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs"
                />
              </label>

              <label className="space-y-1 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">Anomaly Deviation (%)</span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="e.g. 35"
                  value={anomalySpikePct}
                  onChange={(e) => setAnomalySpikePct(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs"
                />
              </label>

              <label className="space-y-1 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">Alert Severity</span>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as 'warning' | 'critical')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs"
                >
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </label>

              <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-3 pt-2">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={alertOnMissing}
                    onChange={(e) => setAlertOnMissing(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600"
                  />
                  Trigger warning when field reading is missing
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRuleForm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white"
                  >
                    Save Rule
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-4">Target Field</th>
                  <th className="py-2.5 px-4">Rule Scope</th>
                  <th className="py-2.5 px-4 text-right">Min</th>
                  <th className="py-2.5 px-4 text-right">Max</th>
                  <th className="py-2.5 px-4 text-right">Spike %</th>
                  <th className="py-2.5 px-4">Severity</th>
                  <th className="py-2.5 px-4">Origin</th>
                  <th className="py-2.5 px-4 text-right">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                      {rule.fieldLabel}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {rule.source === 'all' ? 'All Sources' : rule.source}
                      {rule.alertOnDisconnect ? ' · Disconnect' : ''}
                      {rule.alertOnMissing ? ' · Missing' : ''}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {rule.minThreshold !== null ? rule.minThreshold : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {rule.maxThreshold !== null ? rule.maxThreshold : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {rule.anomalySpikePct !== null ? `${rule.anomalySpikePct}%` : '—'}
                    </td>
                    <td className="py-3 px-4 capitalize font-medium text-slate-800 dark:text-slate-200">
                      {rule.severity}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {rule.isDefaultConfig ? 'Configurable Default' : 'User Rule'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onSaveRule({ ...rule, enabled: !rule.enabled })}
                          className={`text-xs font-medium ${
                            rule.enabled
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {rule.enabled ? 'Enabled' : 'Paused'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRule(rule.id)}
                          aria-label={`Delete rule for ${rule.fieldLabel}`}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
