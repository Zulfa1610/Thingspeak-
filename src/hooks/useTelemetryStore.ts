import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { off, onValue, ref } from 'firebase/database';
import {
  auth,
  buildFirestoreErrorInfo,
  db,
  getRealtimeDbForUrl,
  OperationType,
  signInWithGoogle,
  signOutOperator,
  testConnection,
} from '../lib/firebase';
import { fetchThingSpeakData } from '../services/thingspeakService';
import type {
  AlertEvent,
  AlertRule,
  ConnectionState,
  DashboardConfig,
  MonitoredDevice,
  NormalizedReading,
  SensorSummary,
  ThingSpeakChannelInfo,
} from '../types/iot';
import { buildSensorSummaries, evaluateAlerts } from '../utils/telemetry';

const STORAGE_KEY = 'nexusgrid_iot_config_v1';

export const DEFAULT_CONFIG: DashboardConfig = {
  thingSpeak: {
    enabled: true,
    channelId: '3585272',
    customUrl: '',
    pollingIntervalSec: 15,
    heartbeatTimeoutSec: 120,
    resultsLimit: 200,
  },
  firebase: {
    enabled: true,
    mode: 'firestore',
    firestoreMode: 'devices-subcollection',
    firestoreDevicesCollection: 'devices',
    firestoreReadingsSubcollection: 'readings',
    firestoreCustomCollection: '',
    firestoreTimestampField: 'recordedAt',
    rtdbDatabaseUrl: '',
    rtdbPath: '',
    rtdbTimestampField: 'timestamp',
    heartbeatTimeoutSec: 120,
  },
  fieldMappings: {},
  alertRules: [
    {
      id: 'default-disconnect',
      source: 'all',
      fieldKey: '_heartbeat',
      fieldLabel: 'Device Heartbeat',
      minThreshold: null,
      maxThreshold: null,
      alertOnMissing: false,
      alertOnDisconnect: true,
      anomalySpikePct: null,
      severity: 'critical',
      enabled: true,
      isDefaultConfig: true,
    },
    {
      id: 'default-missing-data',
      source: 'all',
      fieldKey: '*',
      fieldLabel: 'All Telemetry Fields',
      minThreshold: null,
      maxThreshold: null,
      alertOnMissing: true,
      alertOnDisconnect: false,
      anomalySpikePct: null,
      severity: 'warning',
      enabled: true,
      isDefaultConfig: true,
    },
  ],
  settings: {
    theme: 'dark',
    timestampFormat: 'local',
    defaultPollingSec: 15,
    defaultHeartbeatTimeoutSec: 120,
    anomalySensitivityPct: 35,
  },
};

function loadConfig(): DashboardConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      thingSpeak: { ...DEFAULT_CONFIG.thingSpeak, ...(parsed.thingSpeak || {}) },
      firebase: { ...DEFAULT_CONFIG.firebase, ...(parsed.firebase || {}) },
      fieldMappings: parsed.fieldMappings || {},
      alertRules: Array.isArray(parsed.alertRules) ? parsed.alertRules : DEFAULT_CONFIG.alertRules,
      settings: { ...DEFAULT_CONFIG.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function parseFlexibleTimestamp(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Timestamp) return raw.toMillis();
  if (typeof raw === 'object' && raw !== null && 'seconds' in raw) {
    const secs = Number((raw as { seconds: unknown }).seconds);
    if (Number.isFinite(secs)) return secs * 1000;
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    // Heuristic: seconds vs ms
    return raw < 1e12 ? raw * 1000 : raw;
  }
  if (typeof raw === 'string') {
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function extractMetricsFromObject(
  obj: Record<string, unknown>,
  excludedKeys: Set<string>,
): { values: Record<string, number | null>; rawValues: Record<string, string | number | boolean | null> } {
  const values: Record<string, number | null> = {};
  const rawValues: Record<string, string | number | boolean | null> = {};

  const sourceObj =
    typeof obj.metrics === 'object' && obj.metrics !== null && !Array.isArray(obj.metrics)
      ? (obj.metrics as Record<string, unknown>)
      : obj;

  for (const [k, v] of Object.entries(sourceObj)) {
    if (excludedKeys.has(k)) continue;
    if (v === null || v === undefined || v === '') {
      rawValues[k] = null;
      values[k] = null;
    } else if (typeof v === 'number') {
      rawValues[k] = v;
      values[k] = Number.isFinite(v) ? v : null;
    } else if (typeof v === 'string') {
      rawValues[k] = v;
      const num = Number(v.trim());
      values[k] = v.trim() !== '' && Number.isFinite(num) ? num : null;
    } else if (typeof v === 'boolean') {
      rawValues[k] = v;
      values[k] = v ? 1 : 0;
    }
  }

  return { values, rawValues };
}

export function useTelemetryStore() {
  const [config, setConfig] = useState<DashboardConfig>(loadConfig);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Auth & Firebase connection state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState<ConnectionState>('connecting');
  const [firebaseMessage, setFirebaseMessage] = useState<string>('Checking Firestore connection...');
  const [firebaseDevices, setFirebaseDevices] = useState<MonitoredDevice[]>([]);
  const [firebaseReadings, setFirebaseReadings] = useState<NormalizedReading[]>([]);
  const [firebaseFieldLabels, setFirebaseFieldLabels] = useState<Record<string, Record<string, string>>>({});
  const [firebaseLastSyncAt, setFirebaseLastSyncAt] = useState<string | null>(null);

  // ThingSpeak connection state
  const [thingSpeakStatus, setThingSpeakStatus] = useState<ConnectionState>(
    config.thingSpeak.enabled ? 'connecting' : 'unconfigured',
  );
  const [thingSpeakMessage, setThingSpeakMessage] = useState<string>('Initializing ThingSpeak stream...');
  const [thingSpeakChannel, setThingSpeakChannel] = useState<ThingSpeakChannelInfo | null>(null);
  const [thingSpeakReadings, setThingSpeakReadings] = useState<NormalizedReading[]>([]);
  const [thingSpeakLastSyncAt, setThingSpeakLastSyncAt] = useState<string | null>(null);
  const [thingSpeakLatencyMs, setThingSpeakLatencyMs] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [acknowledgedAlertIds, setAcknowledgedAlertIds] = useState<Set<string>>(() => new Set());

  // Persist config
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore storage quota errors
    }
  }, [config]);

  // Apply theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (config.settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [config.settings.theme]);

  // 1-second clock tick for live header & heartbeat timeout calculations
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Auth listener & initial Firestore reachability test
  useEffect(() => {
    testConnection().then((res) => {
      if (res.offline) {
        setFirebaseStatus('error');
        setFirebaseMessage(res.message);
      } else if (!res.ok) {
        setFirebaseStatus('error');
        setFirebaseMessage(res.message);
      }
    });

    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Firebase primary data source real-time listener
  useEffect(() => {
    if (!config.firebase.enabled) {
      setFirebaseStatus('unconfigured');
      setFirebaseMessage('Firebase source disabled in configuration.');
      setFirebaseDevices([]);
      setFirebaseReadings([]);
      setFirebaseFieldLabels({});
      return;
    }

    if (!authReady) return;

    // Mode 1: Firebase Realtime Database
    if (config.firebase.mode === 'rtdb') {
      const dbUrl = config.firebase.rtdbDatabaseUrl.trim();
      const rtdbPath = config.firebase.rtdbPath.trim();
      if (!dbUrl || !rtdbPath) {
        setFirebaseStatus('unconfigured');
        setFirebaseMessage('Configure RTDB databaseURL and path in Data Source Configuration.');
        setFirebaseDevices([]);
        setFirebaseReadings([]);
        return;
      }

      setFirebaseStatus('connecting');
      setFirebaseMessage(`Connecting to RTDB path ${rtdbPath}...`);

      try {
        const rtdb = getRealtimeDbForUrl(dbUrl);
        const targetRef = ref(rtdb, rtdbPath);
        const tsField = config.firebase.rtdbTimestampField || 'timestamp';
        const excluded = new Set([tsField, 'timestamp', 'createdAt', 'recordedAt', 'deviceId', 'deviceName']);

        const listener = onValue(
          targetRef,
          (snapshot) => {
            const val = snapshot.val();
            const syncIso = new Date().toISOString();
            setFirebaseLastSyncAt(syncIso);

            if (val === null || val === undefined) {
              setFirebaseStatus('connected');
              setFirebaseMessage(`Connected to RTDB (${rtdbPath}) — path is currently empty.`);
              setFirebaseDevices([
                {
                  id: `rtdb-${rtdbPath}`,
                  name: `RTDB (${rtdbPath})`,
                  source: 'firebase-rtdb',
                  sourceLabel: 'Firebase RTDB',
                  connectionStatus: 'awaiting',
                  healthStatus: 'unknown',
                  lastCommunicationAt: null,
                  lastCommunicationMs: null,
                  sensorCount: 0,
                  heartbeatTimeoutSec: config.firebase.heartbeatTimeoutSec,
                  pathOrEndpoint: `${dbUrl}${rtdbPath}`,
                  metadata: { path: rtdbPath },
                },
              ]);
              setFirebaseReadings([]);
              return;
            }

            const deviceId = `rtdb-${rtdbPath.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
            const readings: NormalizedReading[] = [];
            const labels: Record<string, string> = {};

            if (typeof val === 'object' && !Array.isArray(val)) {
              const entries = Object.entries(val as Record<string, unknown>);
              const isCollectionOfObjects =
                entries.length > 0 &&
                entries.every(([, child]) => typeof child === 'object' && child !== null && !Array.isArray(child));

              if (isCollectionOfObjects) {
                for (const [entryKey, child] of entries) {
                  const obj = child as Record<string, unknown>;
                  const tsMs =
                    parseFlexibleTimestamp(obj[tsField]) ??
                    parseFlexibleTimestamp(obj.timestamp) ??
                    parseFlexibleTimestamp(obj.createdAt) ??
                    Date.now();
                  const { values, rawValues } = extractMetricsFromObject(obj, excluded);
                  for (const k of Object.keys(values)) labels[k] = k;
                  readings.push({
                    id: `rtdb-${entryKey}`,
                    source: 'firebase-rtdb',
                    sourceLabel: 'Firebase RTDB',
                    deviceId,
                    deviceName: `RTDB Node (${rtdbPath})`,
                    entryId: entryKey,
                    timestamp: new Date(tsMs).toISOString(),
                    timestampMs: tsMs,
                    values,
                    rawValues,
                  });
                }
              } else {
                const obj = val as Record<string, unknown>;
                const tsMs =
                  parseFlexibleTimestamp(obj[tsField]) ??
                  parseFlexibleTimestamp(obj.timestamp) ??
                  parseFlexibleTimestamp(obj.createdAt) ??
                  Date.now();
                const { values, rawValues } = extractMetricsFromObject(obj, excluded);
                for (const k of Object.keys(values)) labels[k] = k;
                readings.push({
                  id: `rtdb-latest-${tsMs}`,
                  source: 'firebase-rtdb',
                  sourceLabel: 'Firebase RTDB',
                  deviceId,
                  deviceName: `RTDB Node (${rtdbPath})`,
                  timestamp: new Date(tsMs).toISOString(),
                  timestampMs: tsMs,
                  values,
                  rawValues,
                });
              }
            }

            readings.sort((a, b) => a.timestampMs - b.timestampMs);
            const latest = readings[readings.length - 1] ?? null;
            const isOnline =
              latest !== null && (Date.now() - latest.timestampMs) / 1000 <= config.firebase.heartbeatTimeoutSec;

            setFirebaseFieldLabels({ [deviceId]: labels });
            setFirebaseReadings(readings);
            setFirebaseDevices([
              {
                id: deviceId,
                name: `RTDB (${rtdbPath})`,
                source: 'firebase-rtdb',
                sourceLabel: 'Firebase RTDB',
                connectionStatus: latest ? (isOnline ? 'online' : 'offline') : 'awaiting',
                healthStatus: latest ? (isOnline ? 'healthy' : 'critical') : 'unknown',
                lastCommunicationAt: latest?.timestamp ?? null,
                lastCommunicationMs: latest?.timestampMs ?? null,
                sensorCount: Object.keys(labels).length,
                heartbeatTimeoutSec: config.firebase.heartbeatTimeoutSec,
                pathOrEndpoint: `${dbUrl}${rtdbPath}`,
                metadata: { path: rtdbPath, sampleCount: readings.length },
              },
            ]);
            setFirebaseStatus('connected');
            setFirebaseMessage(`Realtime Database synced (${readings.length} entries).`);
          },
          (error) => {
            setFirebaseStatus('error');
            setFirebaseMessage(error.message || 'Firebase Realtime Database listener error.');
          },
        );

        return () => {
          off(targetRef, 'value', listener);
        };
      } catch (error) {
        setFirebaseStatus('error');
        setFirebaseMessage(error instanceof Error ? error.message : 'Failed to initialize RTDB listener.');
        return;
      }
    }

    // Mode 2: Cloud Firestore (requires authenticated operator per security rules)
    if (!user) {
      setFirebaseStatus('disconnected');
      setFirebaseMessage('Sign in with Google to stream protected Cloud Firestore telemetry.');
      setFirebaseDevices([]);
      setFirebaseReadings([]);
      setFirebaseFieldLabels({});
      return;
    }

    setFirebaseStatus('connecting');
    setFirebaseMessage('Subscribing to Cloud Firestore listeners...');

    const unsubscribers: Unsubscribe[] = [];
    const readingUnsubs = new Map<string, Unsubscribe>();
    const readingsByDeviceMap = new Map<string, NormalizedReading[]>();
    const labelsByDeviceMap = new Map<string, Record<string, string>>();

    const syncAggregatedReadings = () => {
      const merged: NormalizedReading[] = [];
      for (const list of readingsByDeviceMap.values()) {
        merged.push(...list);
      }
      merged.sort((a, b) => a.timestampMs - b.timestampMs);
      setFirebaseReadings(merged);

      const labelObj: Record<string, Record<string, string>> = {};
      for (const [devId, map] of labelsByDeviceMap.entries()) {
        labelObj[devId] = map;
      }
      setFirebaseFieldLabels(labelObj);
    };

    if (config.firebase.firestoreMode === 'custom-collection') {
      const customPath = config.firebase.firestoreCustomCollection.trim();
      if (!customPath) {
        setFirebaseStatus('unconfigured');
        setFirebaseMessage('Specify a Firestore collection path in Data Source Configuration.');
        return;
      }

      const tsField = config.firebase.firestoreTimestampField || 'recordedAt';
      const excluded = new Set([tsField, 'recordedAt', 'createdAt', 'timestamp', 'ownerId', 'deviceId', 'readingId', 'source']);
      const colRef = collection(db, customPath);

      const unsub = onSnapshot(
        query(colRef, limit(200)),
        (snap) => {
          const syncIso = new Date().toISOString();
          setFirebaseLastSyncAt(syncIso);

          const devId = `fs-col-${customPath.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
          const parsedReadings: NormalizedReading[] = [];
          const labels: Record<string, string> = {};

          snap.forEach((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            const tsMs =
              parseFlexibleTimestamp(data[tsField]) ??
              parseFlexibleTimestamp(data.recordedAt) ??
              parseFlexibleTimestamp(data.createdAt) ??
              parseFlexibleTimestamp(data.timestamp) ??
              Date.now();
            const { values, rawValues } = extractMetricsFromObject(data, excluded);
            for (const k of Object.keys(values)) labels[k] = k;

            parsedReadings.push({
              id: `fs-${docSnap.id}`,
              source: 'firebase-firestore',
              sourceLabel: 'Firebase Firestore',
              deviceId: devId,
              deviceName: `Firestore (${customPath})`,
              entryId: docSnap.id,
              timestamp: new Date(tsMs).toISOString(),
              timestampMs: tsMs,
              values,
              rawValues,
            });
          });

          parsedReadings.sort((a, b) => a.timestampMs - b.timestampMs);
          const latest = parsedReadings[parsedReadings.length - 1] ?? null;
          const isOnline =
            latest !== null && (Date.now() - latest.timestampMs) / 1000 <= config.firebase.heartbeatTimeoutSec;

          setFirebaseFieldLabels({ [devId]: labels });
          setFirebaseReadings(parsedReadings);
          setFirebaseDevices([
            {
              id: devId,
              name: `Firestore (${customPath})`,
              source: 'firebase-firestore',
              sourceLabel: 'Firebase Firestore',
              connectionStatus: latest ? (isOnline ? 'online' : 'offline') : 'awaiting',
              healthStatus: latest ? (isOnline ? 'healthy' : 'critical') : 'unknown',
              lastCommunicationAt: latest?.timestamp ?? null,
              lastCommunicationMs: latest?.timestampMs ?? null,
              sensorCount: Object.keys(labels).length,
              heartbeatTimeoutSec: config.firebase.heartbeatTimeoutSec,
              pathOrEndpoint: customPath,
              metadata: { collection: customPath, documentCount: snap.size },
            },
          ]);
          setFirebaseStatus('connected');
          setFirebaseMessage(`Listening to "${customPath}" (${snap.size} documents).`);
        },
        (error) => {
          const info = buildFirestoreErrorInfo(error, OperationType.LIST, customPath);
          console.error('Firestore Error: ', JSON.stringify(info));
          setFirebaseStatus('error');
          setFirebaseMessage(info.error);
        },
      );
      unsubscribers.push(unsub);
    } else {
      const devicesColPath = config.firebase.firestoreDevicesCollection.trim() || 'devices';
      const readingsSubPath = config.firebase.firestoreReadingsSubcollection.trim() || 'readings';
      const tsField = config.firebase.firestoreTimestampField || 'recordedAt';
      const excluded = new Set([tsField, 'recordedAt', 'createdAt', 'timestamp', 'ownerId', 'deviceId', 'readingId', 'source']);

      const devicesQuery = query(collection(db, devicesColPath), where('ownerId', '==', user.uid));

      const unsubDevices = onSnapshot(
        devicesQuery,
        (devicesSnap) => {
          setFirebaseLastSyncAt(new Date().toISOString());
          const activeDeviceIds = new Set<string>();
          const deviceList: MonitoredDevice[] = [];

          devicesSnap.forEach((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            const deviceId = docSnap.id;
            activeDeviceIds.add(deviceId);

            const timeoutSec =
              typeof data.heartbeatTimeoutSec === 'number'
                ? data.heartbeatTimeoutSec
                : config.firebase.heartbeatTimeoutSec;

            const existingReadings = readingsByDeviceMap.get(deviceId) || [];
            const latest = existingReadings[existingReadings.length - 1] ?? null;
            const lastMs = latest?.timestampMs ?? null;
            const isOnline = lastMs !== null && (Date.now() - lastMs) / 1000 <= timeoutSec;
            const labels = labelsByDeviceMap.get(deviceId) || {};

            deviceList.push({
              id: deviceId,
              name: typeof data.name === 'string' && data.name ? data.name : deviceId,
              source: 'firebase-firestore',
              sourceLabel: 'Firebase Firestore',
              connectionStatus: latest ? (isOnline ? 'online' : 'offline') : 'awaiting',
              healthStatus: latest ? (isOnline ? 'healthy' : 'critical') : 'unknown',
              lastCommunicationAt: latest?.timestamp ?? null,
              lastCommunicationMs: lastMs,
              sensorCount: Object.keys(labels).length,
              heartbeatTimeoutSec: timeoutSec,
              pathOrEndpoint: `${devicesColPath}/${deviceId}/${readingsSubPath}`,
              metadata: {
                deviceId,
                sourceType: typeof data.sourceType === 'string' ? data.sourceType : 'firestore',
              },
            });

            if (!readingUnsubs.has(deviceId)) {
              const subPath = `${devicesColPath}/${deviceId}/${readingsSubPath}`;
              const subQuery = query(
                collection(db, devicesColPath, deviceId, readingsSubPath),
                orderBy(tsField, 'desc'),
                limit(200),
              );
              const subUnsub = onSnapshot(
                subQuery,
                (readingsSnap) => {
                  setFirebaseLastSyncAt(new Date().toISOString());
                  const parsed: NormalizedReading[] = [];
                  const fieldMap: Record<string, string> = {};

                  readingsSnap.forEach((rSnap) => {
                    const rData = rSnap.data() as Record<string, unknown>;
                    const tsMs =
                      parseFlexibleTimestamp(rData[tsField]) ??
                      parseFlexibleTimestamp(rData.recordedAt) ??
                      parseFlexibleTimestamp(rData.createdAt) ??
                      Date.now();
                    const { values, rawValues } = extractMetricsFromObject(rData, excluded);
                    for (const k of Object.keys(values)) fieldMap[k] = k;

                    parsed.push({
                      id: `fs-${deviceId}-${rSnap.id}`,
                      source: 'firebase-firestore',
                      sourceLabel: 'Firebase Firestore',
                      deviceId,
                      deviceName: typeof data.name === 'string' && data.name ? data.name : deviceId,
                      entryId: rSnap.id,
                      timestamp: new Date(tsMs).toISOString(),
                      timestampMs: tsMs,
                      values,
                      rawValues,
                    });
                  });

                  parsed.sort((a, b) => a.timestampMs - b.timestampMs);
                  readingsByDeviceMap.set(deviceId, parsed);
                  labelsByDeviceMap.set(deviceId, fieldMap);
                  syncAggregatedReadings();

                  const newest = parsed[parsed.length - 1] ?? null;
                  setFirebaseDevices((prev) =>
                    prev.map((d) => {
                      if (d.id !== deviceId) return d;
                      const online =
                        newest !== null && (Date.now() - newest.timestampMs) / 1000 <= d.heartbeatTimeoutSec;
                      return {
                        ...d,
                        connectionStatus: newest ? (online ? 'online' : 'offline') : 'awaiting',
                        healthStatus: newest ? (online ? 'healthy' : 'critical') : 'unknown',
                        lastCommunicationAt: newest?.timestamp ?? null,
                        lastCommunicationMs: newest?.timestampMs ?? null,
                        sensorCount: Object.keys(fieldMap).length,
                      };
                    }),
                  );
                },
                (err) => {
                  const info = buildFirestoreErrorInfo(err, OperationType.LIST, subPath);
                  console.error('Firestore Error: ', JSON.stringify(info));
                  setFirebaseStatus('error');
                  setFirebaseMessage(info.error);
                },
              );
              readingUnsubs.set(deviceId, subUnsub);
            }
          });

          // Clean up removed devices
          for (const [devId, unsubFn] of readingUnsubs.entries()) {
            if (!activeDeviceIds.has(devId)) {
              unsubFn();
              readingUnsubs.delete(devId);
              readingsByDeviceMap.delete(devId);
              labelsByDeviceMap.delete(devId);
            }
          }

          setFirebaseDevices(deviceList);
          syncAggregatedReadings();
          setFirebaseStatus('connected');
          setFirebaseMessage(
            deviceList.length > 0
              ? `Firestore active (${deviceList.length} device${deviceList.length > 1 ? 's' : ''}).`
              : `Connected to Firestore "${devicesColPath}" — 0 devices registered for this operator.`,
          );
        },
        (error) => {
          const info = buildFirestoreErrorInfo(error, OperationType.LIST, devicesColPath);
          console.error('Firestore Error: ', JSON.stringify(info));
          setFirebaseStatus('error');
          setFirebaseMessage(info.error);
        },
      );
      unsubscribers.push(unsubDevices);
    }

    return () => {
      for (const u of unsubscribers) u();
      for (const u of readingUnsubs.values()) u();
    };
  }, [authReady, user, config.firebase]);

  // ThingSpeak polling fetcher
  const loadThingSpeak = useCallback(async () => {
    if (!config.thingSpeak.enabled) {
      setThingSpeakStatus('unconfigured');
      setThingSpeakMessage('ThingSpeak source disabled.');
      setThingSpeakChannel(null);
      setThingSpeakReadings([]);
      return;
    }

    try {
      const result = await fetchThingSpeakData(config.thingSpeak, config.fieldMappings);
      setThingSpeakChannel(result.channel);
      setThingSpeakReadings(result.readings);
      setThingSpeakLastSyncAt(result.fetchedAt);
      setThingSpeakLatencyMs(result.latencyMs);
      setThingSpeakStatus('connected');
      setThingSpeakMessage(
        `Channel ${result.channel.id} (${result.channel.name}) — ${result.readings.length} entries loaded.`,
      );
    } catch (error) {
      setThingSpeakStatus('error');
      setThingSpeakMessage(error instanceof Error ? error.message : 'ThingSpeak connection error.');
    }
  }, [config.thingSpeak, config.fieldMappings]);

  useEffect(() => {
    loadThingSpeak();
    if (!config.thingSpeak.enabled) return;

    const intervalMs = Math.max(5, config.thingSpeak.pollingIntervalSec) * 1000;
    const timer = window.setInterval(() => {
      loadThingSpeak();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [loadThingSpeak, config.thingSpeak.enabled, config.thingSpeak.pollingIntervalSec]);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadThingSpeak(),
        testConnection().then((res) => {
          if (res.offline || !res.ok) {
            setFirebaseStatus('error');
            setFirebaseMessage(res.message);
          }
        }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadThingSpeak]);

  // Build ThingSpeak MonitoredDevice from live channel response
  const thingSpeakDevice = useMemo<MonitoredDevice | null>(() => {
    if (!config.thingSpeak.enabled || !thingSpeakChannel) return null;
    const latest = thingSpeakReadings[thingSpeakReadings.length - 1] ?? null;
    const lastMs = latest?.timestampMs ?? null;
    const timeoutSec = config.thingSpeak.heartbeatTimeoutSec;
    const isOnline = lastMs !== null && (nowMs - lastMs) / 1000 <= timeoutSec;

    return {
      id: `ts-ch-${thingSpeakChannel.id}`,
      name: thingSpeakChannel.name,
      source: 'thingspeak',
      sourceLabel: 'ThingSpeak API',
      connectionStatus: latest ? (isOnline ? 'online' : 'offline') : 'awaiting',
      healthStatus: latest ? (isOnline ? 'healthy' : 'critical') : 'unknown',
      lastCommunicationAt: latest?.timestamp ?? null,
      lastCommunicationMs: lastMs,
      sensorCount: Object.keys(thingSpeakChannel.fieldLabels).length,
      heartbeatTimeoutSec: timeoutSec,
      pathOrEndpoint: config.thingSpeak.customUrl.trim() || `Channel ${thingSpeakChannel.id}`,
      metadata: {
        channelId: thingSpeakChannel.id,
        lastEntryId: thingSpeakChannel.lastEntryId,
        createdAt: thingSpeakChannel.createdAt,
        updatedAt: thingSpeakChannel.updatedAt,
        latitude: thingSpeakChannel.latitude,
        longitude: thingSpeakChannel.longitude,
      },
    };
  }, [config.thingSpeak, thingSpeakChannel, thingSpeakReadings, nowMs]);

  // Combined devices & readings (always cleanly tagged with source)
  const devices = useMemo<MonitoredDevice[]>(() => {
    const list: MonitoredDevice[] = [...firebaseDevices];
    if (thingSpeakDevice) list.push(thingSpeakDevice);
    return list;
  }, [firebaseDevices, thingSpeakDevice]);

  const readings = useMemo<NormalizedReading[]>(() => {
    const combined = [...firebaseReadings, ...thingSpeakReadings];
    combined.sort((a, b) => a.timestampMs - b.timestampMs);
    return combined;
  }, [firebaseReadings, thingSpeakReadings]);

  const fieldLabelsByDevice = useMemo<Record<string, Record<string, string>>>(() => {
    const merged: Record<string, Record<string, string>> = { ...firebaseFieldLabels };
    if (thingSpeakChannel) {
      merged[`ts-ch-${thingSpeakChannel.id}`] = thingSpeakChannel.fieldLabels;
    }
    return merged;
  }, [firebaseFieldLabels, thingSpeakChannel]);

  const sensors = useMemo<SensorSummary[]>(
    () => buildSensorSummaries(readings, devices, fieldLabelsByDevice, config.fieldMappings, nowMs),
    [readings, devices, fieldLabelsByDevice, config.fieldMappings, nowMs],
  );

  const alerts = useMemo<AlertEvent[]>(
    () => evaluateAlerts(sensors, devices, readings, config.alertRules, nowMs, acknowledgedAlertIds),
    [sensors, devices, readings, config.alertRules, nowMs, acknowledgedAlertIds],
  );

  // Update Device health status when alerts fire
  const enrichedDevices = useMemo<MonitoredDevice[]>(() => {
    return devices.map((dev) => {
      if (dev.connectionStatus === 'offline') {
        return { ...dev, healthStatus: 'critical' };
      }
      if (dev.connectionStatus === 'awaiting') {
        return { ...dev, healthStatus: 'unknown' };
      }
      const devAlerts = alerts.filter((a) => a.deviceId === dev.id && !a.acknowledged);
      if (devAlerts.some((a) => a.severity === 'critical')) {
        return { ...dev, healthStatus: 'critical' };
      }
      if (devAlerts.some((a) => a.severity === 'warning')) {
        return { ...dev, healthStatus: 'warning' };
      }
      return { ...dev, healthStatus: 'healthy' };
    });
  }, [devices, alerts]);

  const lastSyncAt = useMemo<string | null>(() => {
    const candidates = [firebaseLastSyncAt, thingSpeakLastSyncAt].filter((v): v is string => Boolean(v));
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => Date.parse(b) - Date.parse(a));
    return candidates[0];
  }, [firebaseLastSyncAt, thingSpeakLastSyncAt]);

  const acknowledgeAlert = useCallback((id: string) => {
    setAcknowledgedAlertIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const acknowledgeAllAlerts = useCallback(() => {
    setAcknowledgedAlertIds((prev) => {
      const next = new Set(prev);
      for (const a of alerts) next.add(a.id);
      return next;
    });
  }, [alerts]);

  const toggleTheme = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        theme: prev.settings.theme === 'dark' ? 'light' : 'dark',
      },
    }));
  }, []);

  const updateConfig = useCallback((updater: (prev: DashboardConfig) => DashboardConfig) => {
    setConfig(updater);
  }, []);

  const resetConfig = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setConfig(DEFAULT_CONFIG);
  }, []);

  const addOrUpdateAlertRule = useCallback((rule: AlertRule) => {
    setConfig((prev) => {
      const exists = prev.alertRules.some((r) => r.id === rule.id);
      return {
        ...prev,
        alertRules: exists
          ? prev.alertRules.map((r) => (r.id === rule.id ? rule : r))
          : [...prev.alertRules, rule],
      };
    });
  }, []);

  const deleteAlertRule = useCallback((ruleId: string) => {
    setConfig((prev) => ({
      ...prev,
      alertRules: prev.alertRules.filter((r) => r.id !== ruleId),
    }));
  }, []);

  return {
    config,
    updateConfig,
    resetConfig,
    toggleTheme,
    nowMs,
    user,
    authReady,
    signInWithGoogle,
    signOutOperator,
    firebaseStatus,
    firebaseMessage,
    firebaseLastSyncAt,
    thingSpeakStatus,
    thingSpeakMessage,
    thingSpeakChannel,
    thingSpeakLastSyncAt,
    thingSpeakLatencyMs,
    lastSyncAt,
    isRefreshing,
    refreshAll,
    devices: enrichedDevices,
    readings,
    sensors,
    alerts,
    acknowledgeAlert,
    acknowledgeAllAlerts,
    addOrUpdateAlertRule,
    deleteAlertRule,
  };
}

export type TelemetryStore = ReturnType<typeof useTelemetryStore>;
