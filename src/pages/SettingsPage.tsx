import React, { useState } from 'react';
import { Check, RotateCcw, Save } from 'lucide-react';
import type { TelemetryStore } from '../hooks/useTelemetryStore';
import type { TimestampFormat } from '../types/iot';

interface SettingsPageProps {
  store: TelemetryStore;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ store }) => {
  const [settingsDraft, setSettingsDraft] = useState(store.config.settings);
  const [confirmReset, setConfirmReset] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateConfig((prev) => ({
      ...prev,
      settings: settingsDraft,
      thingSpeak: {
        ...prev.thingSpeak,
        pollingIntervalSec: settingsDraft.defaultPollingSec,
        heartbeatTimeoutSec: settingsDraft.defaultHeartbeatTimeoutSec,
      },
      firebase: {
        ...prev.firebase,
        heartbeatTimeoutSec: settingsDraft.defaultHeartbeatTimeoutSec,
      },
    }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <section className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-6 space-y-5">
        <div>
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
            Application Preferences & Monitoring Defaults
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure display theme, timestamp formatting, and global heartbeat timeout thresholds.
          </p>
        </div>

        {saved && (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4" />
            Application settings saved.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Interface Theme</span>
              <select
                value={settingsDraft.theme}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, theme: e.target.value as 'dark' | 'light' })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                <option value="dark">Dark Industrial (Default)</option>
                <option value="light">Light Laboratory</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Timestamp Format</span>
              <select
                value={settingsDraft.timestampFormat}
                onChange={(e) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    timestampFormat: e.target.value as TimestampFormat,
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                <option value="local">Local Timezone</option>
                <option value="utc">UTC Standard</option>
                <option value="iso">ISO 8601</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Global Heartbeat Timeout (seconds)
              </span>
              <input
                type="number"
                min={5}
                max={86400}
                value={settingsDraft.defaultHeartbeatTimeoutSec}
                onChange={(e) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    defaultHeartbeatTimeoutSec: Math.max(5, Number(e.target.value) || 120),
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
              />
            </label>

            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                ThingSpeak Polling Cadence (seconds)
              </span>
              <input
                type="number"
                min={5}
                max={3600}
                value={settingsDraft.defaultPollingSec}
                onChange={(e) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    defaultPollingSec: Math.max(5, Number(e.target.value) || 15),
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
              />
            </label>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white"
            >
              <Save className="w-3.5 h-3.5" />
              Save Settings
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Reset Local Dashboard Configuration
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Restore default data source paths, field unit overrides, and alert rule defaults.
          </p>
        </div>

        {confirmReset ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                store.resetConfig();
                setConfirmReset(false);
              }}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-500 text-white"
            >
              Confirm Reset
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
        )}
      </section>
    </div>
  );
};
