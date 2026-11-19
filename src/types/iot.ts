export type DataSourceType = 'firebase-firestore' | 'firebase-rtdb' | 'thingspeak';

export type PageId =
  | 'overview'
  | 'live'
  | 'history'
  | 'devices'
  | 'device-details'
  | 'alerts'
  | 'analytics'
  | 'sources'
  | 'settings';

export type TimeRangeKey = '1h' | '6h' | '24h' | '7d' | 'custom';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error' | 'unconfigured';

export type AlertSeverity = 'critical' | 'warning' | 'normal';

export type TimestampFormat = 'local' | 'utc' | 'iso';

export interface FieldMappingOverride {
  label?: string;
  unit?: string;
}

export interface SensorFieldMeta {
  key: string;
  fieldKey: string;
  label: string;
  unit: string;
  source: DataSourceType;
  deviceId: string;
  deviceName: string;
}

export interface NormalizedReading {
  id: string;
  source: DataSourceType;
  sourceLabel: string;
  deviceId: string;
  deviceName: string;
  entryId?: number | string;
  timestamp: string;
  timestampMs: number;
  values: Record<string, number | null>;
  rawValues: Record<string, string | number | boolean | null>;
}

export interface SensorSummary {
  id: string;
  fieldKey: string;
  label: string;
  unit: string;
  source: DataSourceType;
  sourceLabel: string;
  deviceId: string;
  deviceName: string;
  currentValue: number | null;
  previousValue: number | null;
  delta: number | null;
  trend: 'up' | 'down' | 'flat' | 'missing';
  status: 'online' | 'offline' | 'missing';
  lastUpdated: string | null;
  lastUpdatedMs: number | null;
}

export interface MonitoredDevice {
  id: string;
  name: string;
  source: DataSourceType;
  sourceLabel: string;
  connectionStatus: 'online' | 'offline' | 'awaiting';
  healthStatus: 'healthy' | 'warning' | 'critical' | 'unknown';
  lastCommunicationAt: string | null;
  lastCommunicationMs: number | null;
  sensorCount: number;
  heartbeatTimeoutSec: number;
  pathOrEndpoint: string;
  metadata: Record<string, string | number | null>;
}

export interface AlertRule {
  id: string;
  source: DataSourceType | 'all';
  fieldKey: string;
  fieldLabel: string;
  minThreshold: number | null;
  maxThreshold: number | null;
  alertOnMissing: boolean;
  alertOnDisconnect: boolean;
  anomalySpikePct: number | null;
  severity: 'warning' | 'critical';
  enabled: boolean;
  isDefaultConfig: boolean;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  source: DataSourceType;
  sourceLabel: string;
  deviceId: string;
  deviceName: string;
  fieldKey: string;
  fieldLabel: string;
  type: 'high_threshold' | 'low_threshold' | 'disconnection' | 'missing_data' | 'abnormal_reading';
  severity: AlertSeverity;
  message: string;
  value: number | null;
  unit: string;
  timestamp: string;
  timestampMs: number;
  acknowledged: boolean;
}

export interface ThingSpeakChannelInfo {
  id: number;
  name: string;
  latitude: string | null;
  longitude: string | null;
  createdAt: string;
  updatedAt: string;
  lastEntryId: number | null;
  fieldLabels: Record<string, string>;
}

export interface ThingSpeakConfig {
  enabled: boolean;
  channelId: string;
  customUrl: string;
  pollingIntervalSec: number;
  heartbeatTimeoutSec: number;
  resultsLimit: number;
}

export interface FirebaseSourceConfig {
  enabled: boolean;
  mode: 'firestore' | 'rtdb';
  firestoreMode: 'devices-subcollection' | 'custom-collection';
  firestoreDevicesCollection: string;
  firestoreReadingsSubcollection: string;
  firestoreCustomCollection: string;
  firestoreTimestampField: string;
  rtdbDatabaseUrl: string;
  rtdbPath: string;
  rtdbTimestampField: string;
  heartbeatTimeoutSec: number;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  timestampFormat: TimestampFormat;
  defaultPollingSec: number;
  defaultHeartbeatTimeoutSec: number;
  anomalySensitivityPct: number;
}

export interface DashboardConfig {
  thingSpeak: ThingSpeakConfig;
  firebase: FirebaseSourceConfig;
  fieldMappings: Record<string, FieldMappingOverride>;
  alertRules: AlertRule[];
  settings: AppSettings;
}

export interface SensorAnalyticsStat {
  sensorId: string;
  fieldKey: string;
  label: string;
  unit: string;
  source: DataSourceType;
  sourceLabel: string;
  deviceId: string;
  deviceName: string;
  sampleCount: number;
  validCount: number;
  missingCount: number;
  availabilityPct: number | null;
  currentValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  avgValue: number | null;
  stdDev: number | null;
  uptimePct: number | null;
  uptimeNote: string;
}
