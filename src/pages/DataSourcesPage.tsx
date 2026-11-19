import React, { useState } from 'react';
import { Check, LogIn, LogOut, Save } from 'lucide-react';
import type { TelemetryStore } from '../hooks/useTelemetryStore';
import { provisionedProjectInfo } from '../lib/firebase';
import { DataSourceStatus } from '../components/DataSourceStatus';

interface DataSourcesPageProps {
  store: TelemetryStore;
}

export const DataSourcesPage: React.FC<DataSourcesPageProps> = ({ store }) => {
  const [fbDraft, setFbDraft] = useState(store.config.firebase);
  const [tsDraft, setTsDraft] = useState(store.config.thingSpeak);
  const [mappingDraft, setMappingDraft] = useState(store.config.fieldMappings);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const showSaved = (msg: string) => {
    setSavedNotice(msg);
    window.setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleSaveFirebase = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateConfig((prev) => ({ ...prev, firebase: fbDraft }));
    showSaved('Firebase configuration applied.');
  };

  const handleSaveThingSpeak = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateConfig((prev) => ({ ...prev, thingSpeak: tsDraft }));
    showSaved('ThingSpeak configuration applied.');
  };

  const handleSaveFieldMappings = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateConfig((prev) => ({ ...prev, fieldMappings: mappingDraft }));
    showSaved('Field labels and units saved.');
  };

  const getMappingKey = (source: string, deviceId: string, fieldKey: string) =>
    source === 'thingspeak'
      ? `thingspeak:${deviceId.replace('ts-ch-', '')}:${fieldKey}`
      : `${source}:${deviceId}:${fieldKey}`;

  return (
    <div className="space-y-6">
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
        onConfigureSources={() => {}}
      />

      {savedNotice && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4" />
          {savedNotice}
        </div>
      )}

      {/* Firebase Configuration */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
              Firebase — Primary Database Configuration
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Provisioned Project: <span className="font-mono">{provisionedProjectInfo.projectId}</span> · Database ID:{' '}
              <span className="font-mono">{provisionedProjectInfo.firestoreDatabaseId}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {store.user ? (
              <button
                type="button"
                onClick={() => store.signOutOperator()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out ({store.user.email})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => store.signInWithGoogle()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In with Google
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveFirebase} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Firebase Engine</span>
              <select
                value={fbDraft.mode}
                onChange={(e) => setFbDraft({ ...fbDraft, mode: e.target.value as 'firestore' | 'rtdb' })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                <option value="firestore">Cloud Firestore (Provisioned)</option>
                <option value="rtdb">Firebase Realtime Database (RTDB)</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Heartbeat Timeout (sec)</span>
              <input
                type="number"
                min={5}
                max={86400}
                value={fbDraft.heartbeatTimeoutSec}
                onChange={(e) => setFbDraft({ ...fbDraft, heartbeatTimeoutSec: Number(e.target.value) || 120 })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
              />
            </label>

            <label className="flex items-center gap-2 pt-6 text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={fbDraft.enabled}
                onChange={(e) => setFbDraft({ ...fbDraft, enabled: e.target.checked })}
              />
              Enable Firebase real-time listeners
            </label>
          </div>

          {fbDraft.mode === 'firestore' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
              <label className="space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Collection Schema Mode</span>
                <select
                  value={fbDraft.firestoreMode}
                  onChange={(e) =>
                    setFbDraft({
                      ...fbDraft,
                      firestoreMode: e.target.value as 'devices-subcollection' | 'custom-collection',
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  <option value="devices-subcollection">Devices + Readings Subcollection</option>
                  <option value="custom-collection">Custom Top-Level Collection</option>
                </select>
              </label>

              {fbDraft.firestoreMode === 'devices-subcollection' ? (
                <>
                  <label className="space-y-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Devices Collection</span>
                    <input
                      type="text"
                      value={fbDraft.firestoreDevicesCollection}
                      onChange={(e) => setFbDraft({ ...fbDraft, firestoreDevicesCollection: e.target.value })}
                      placeholder="devices"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Readings Subcollection</span>
                    <input
                      type="text"
                      value={fbDraft.firestoreReadingsSubcollection}
                      onChange={(e) => setFbDraft({ ...fbDraft, firestoreReadingsSubcollection: e.target.value })}
                      placeholder="readings"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </label>
                </>
              ) : (
                <label className="space-y-1 md:col-span-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Custom Collection Path</span>
                  <input
                    type="text"
                    value={fbDraft.firestoreCustomCollection}
                    onChange={(e) => setFbDraft({ ...fbDraft, firestoreCustomCollection: e.target.value })}
                    placeholder="e.g. sensor_readings or telemetry"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </label>
              )}

              <label className="space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Timestamp Field Name</span>
                <input
                  type="text"
                  value={fbDraft.firestoreTimestampField}
                  onChange={(e) => setFbDraft({ ...fbDraft, firestoreTimestampField: e.target.value })}
                  placeholder="recordedAt"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
                />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
              <label className="space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">RTDB Database URL</span>
                <input
                  type="url"
                  value={fbDraft.rtdbDatabaseUrl}
                  onChange={(e) => setFbDraft({ ...fbDraft, rtdbDatabaseUrl: e.target.value })}
                  placeholder="https://your-project-default-rtdb.firebaseio.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
                />
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">RTDB Node Path</span>
                <input
                  type="text"
                  value={fbDraft.rtdbPath}
                  onChange={(e) => setFbDraft({ ...fbDraft, rtdbPath: e.target.value })}
                  placeholder="/sensors"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
                />
              </label>
              <label className="space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Timestamp Key</span>
                <input
                  type="text"
                  value={fbDraft.rtdbTimestampField}
                  onChange={(e) => setFbDraft({ ...fbDraft, rtdbTimestampField: e.target.value })}
                  placeholder="timestamp"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
                />
              </label>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white"
            >
              <Save className="w-3.5 h-3.5" />
              Apply Firebase Config
            </button>
          </div>
        </form>
      </section>

      {/* ThingSpeak Configuration */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-6 space-y-5">
        <div className="pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
            ThingSpeak API — Secondary Data Source
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Requests route securely through the backend /api/thingspeak proxy. Read API credentials stay server-side.
          </p>
        </div>

        <form onSubmit={handleSaveThingSpeak} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Channel ID</span>
              <input
                type="text"
                value={tsDraft.channelId}
                onChange={(e) => setTsDraft({ ...tsDraft, channelId: e.target.value })}
                placeholder="3585272"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Optional Custom ThingSpeak Read URL
              </span>
              <input
                type="url"
                value={tsDraft.customUrl}
                onChange={(e) => setTsDraft({ ...tsDraft, customUrl: e.target.value })}
                placeholder="Leave blank to use server-proxied Channel 3585272"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
              />
            </label>

            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Polling Interval (sec)</span>
              <input
                type="number"
                min={5}
                max={3600}
                value={tsDraft.pollingIntervalSec}
                onChange={(e) => setTsDraft({ ...tsDraft, pollingIntervalSec: Math.max(5, Number(e.target.value) || 15) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
              />
            </label>

            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Heartbeat Timeout (sec)</span>
              <input
                type="number"
                min={5}
                max={86400}
                value={tsDraft.heartbeatTimeoutSec}
                onChange={(e) => setTsDraft({ ...tsDraft, heartbeatTimeoutSec: Number(e.target.value) || 120 })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
              />
            </label>

            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">History Fetch Count</span>
              <input
                type="number"
                min={1}
                max={8000}
                value={tsDraft.resultsLimit}
                onChange={(e) => setTsDraft({ ...tsDraft, resultsLimit: Math.min(8000, Math.max(1, Number(e.target.value) || 200)) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={tsDraft.enabled}
                onChange={(e) => setTsDraft({ ...tsDraft, enabled: e.target.checked })}
              />
              Enable ThingSpeak automatic polling
            </label>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white"
            >
              <Save className="w-3.5 h-3.5" />
              Apply ThingSpeak Config
            </button>
          </div>
        </form>
      </section>

      {/* Dynamic Field & Unit Mapping */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#111827] p-6 space-y-4">
        <div>
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
            Field Label & Unit Confirmation
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sensor labels are read dynamically from Firebase and ThingSpeak. Confirm measurement units (e.g. °C, %, lx, cm) here to display them on overview cards and exports.
          </p>
        </div>

        {store.sensors.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
            No fields discovered yet. Once Firebase or ThingSpeak returns records, discovered fields will appear here for unit mapping.
          </p>
        ) : (
          <form onSubmit={handleSaveFieldMappings} className="space-y-4">
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-4">Source</th>
                    <th className="py-2.5 px-4">Raw Field Key</th>
                    <th className="py-2.5 px-4">Display Label</th>
                    <th className="py-2.5 px-4">Confirmed Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {store.sensors.map((s) => {
                    const key = getMappingKey(s.source, s.deviceId, s.fieldKey);
                    const current = mappingDraft[key] || {};
                    return (
                      <tr key={s.id}>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {s.sourceLabel}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                          {s.fieldKey}
                        </td>
                        <td className="py-2.5 px-4">
                          <input
                            type="text"
                            value={current.label ?? s.label}
                            onChange={(e) =>
                              setMappingDraft((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], label: e.target.value },
                              }))
                            }
                            className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <input
                            type="text"
                            value={current.unit ?? s.unit}
                            placeholder="Unconfirmed (e.g. °C, %)"
                            onChange={(e) =>
                              setMappingDraft((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], unit: e.target.value },
                              }))
                            }
                            className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white"
              >
                <Save className="w-3.5 h-3.5" />
                Save Field Mappings
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
};
