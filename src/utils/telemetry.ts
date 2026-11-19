import type {
  AlertEvent,
  AlertRule,
  DataSourceType,
  FieldMappingOverride,
  MonitoredDevice,
  NormalizedReading,
  SensorAnalyticsStat,
  SensorSummary,
  TimeRangeKey,
  TimestampFormat,
} from '../types/iot';

export function formatTimestamp(ts: string | number | null, format: TimestampFormat): string {
  if (ts === null || ts === undefined || ts === '') return '—';
  const ms = typeof ts === 'number' ? ts : Date.parse(ts);
  if (!Number.isFinite(ms)) return '—';
  const d = new Date(ms);

  if (format === 'iso') {
    return d.toISOString();
  }
  if (format === 'utc') {
    return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  }
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatShortTime(ms: number, format: TimestampFormat): string {
  const d = new Date(ms);
  if (format === 'utc' || format === 'iso') {
    return d.toISOString().slice(11, 19);
  }
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatRelativeDuration(lastMs: number | null, nowMs: number): string {
  if (!lastMs || !Number.isFinite(lastMs)) return 'Never';
  const diffSec = Math.max(0, Math.floor((nowMs - lastMs) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 48) return `${diffHr}h ${diffMin % 60}m ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function getSourceLabel(source: DataSourceType): string {
  if (source === 'firebase-firestore') return 'Firebase Firestore';
  if (source === 'firebase-rtdb') return 'Firebase RTDB';
  return 'ThingSpeak API';
}

export function filterReadingsByRange(
  readings: NormalizedReading[],
  range: TimeRangeKey,
  customStart?: string,
  customEnd?: string,
  referenceNowMs?: number,
): NormalizedReading[] {
  if (readings.length === 0) return [];
  const now = referenceNowMs ?? Date.now();

  if (range === 'custom') {
    const startMs = customStart ? Date.parse(customStart) : -Infinity;
    const endMs = customEnd ? Date.parse(customEnd) : Infinity;
    return readings.filter((r) => {
      if (Number.isFinite(startMs) && r.timestampMs < startMs) return false;
      if (Number.isFinite(endMs) && r.timestampMs > endMs) return false;
      return true;
    });
  }

  const hoursMap: Record<Exclude<TimeRangeKey, 'custom'>, number> = {
    '1h': 1,
    '6h': 6,
    '24h': 24,
    '7d': 168,
  };
  const cutoff = now - hoursMap[range] * 3600 * 1000;
  return readings.filter((r) => r.timestampMs >= cutoff);
}

export function buildSensorSummaries(
  readings: NormalizedReading[],
  devices: MonitoredDevice[],
  fieldLabelsByDevice: Record<string, Record<string, string>>,
  fieldMappings: Record<string, FieldMappingOverride>,
  nowMs: number,
): SensorSummary[] {
  const summaries: SensorSummary[] = [];
  const deviceMap = new Map(devices.map((d) => [d.id, d]));

  // Group readings by deviceId
  const readingsByDevice = new Map<string, NormalizedReading[]>();
  for (const r of readings) {
    const arr = readingsByDevice.get(r.deviceId) || [];
    arr.push(r);
    readingsByDevice.set(r.deviceId, arr);
  }

  for (const device of devices) {
    const devReadings = (readingsByDevice.get(device.id) || []).slice().sort((a, b) => a.timestampMs - b.timestampMs);
    const knownLabels = { ...(fieldLabelsByDevice[device.id] || {}) };

    // Discover any keys present in readings even if metadata lacked labels
    for (const r of devReadings) {
      for (const k of Object.keys(r.values)) {
        if (!knownLabels[k]) {
          knownLabels[k] = k;
        }
      }
    }

    const latest = devReadings[devReadings.length - 1] ?? null;
    const prev = devReadings.length >= 2 ? devReadings[devReadings.length - 2] : null;
    const isOnlineByHeartbeat =
      latest !== null && (nowMs - latest.timestampMs) / 1000 <= device.heartbeatTimeoutSec;

    for (const [fieldKey, defaultLabel] of Object.entries(knownLabels)) {
      const mappingKey =
        device.source === 'thingspeak'
          ? `thingspeak:${device.id.replace('ts-ch-', '')}:${fieldKey}`
          : `${device.source}:${device.id}:${fieldKey}`;

      const override = fieldMappings[mappingKey];
      const label = override?.label?.trim() || defaultLabel;
      const unit = override?.unit?.trim() || '';

      const currentValue = latest ? (latest.values[fieldKey] ?? null) : null;
      const previousValue = prev ? (prev.values[fieldKey] ?? null) : null;

      let delta: number | null = null;
      let trend: SensorSummary['trend'] = 'missing';
      if (currentValue !== null && previousValue !== null) {
        delta = Number((currentValue - previousValue).toFixed(4));
        if (Math.abs(delta) < 1e-6) trend = 'flat';
        else if (delta > 0) trend = 'up';
        else trend = 'down';
      } else if (currentValue !== null) {
        trend = 'flat';
      }

      let status: SensorSummary['status'] = 'missing';
      if (currentValue === null) {
        status = 'missing';
      } else if (isOnlineByHeartbeat) {
        status = 'online';
      } else {
        status = 'offline';
      }

      summaries.push({
        id: `${device.id}:${fieldKey}`,
        fieldKey,
        label,
        unit,
        source: device.source,
        sourceLabel: device.sourceLabel,
        deviceId: device.id,
        deviceName: device.name,
        currentValue,
        previousValue,
        delta,
        trend,
        status,
        lastUpdated: latest ? latest.timestamp : device.lastCommunicationAt,
        lastUpdatedMs: latest ? latest.timestampMs : device.lastCommunicationMs,
      });
    }
  }

  return summaries;
}

export function evaluateAlerts(
  sensors: SensorSummary[],
  devices: MonitoredDevice[],
  readings: NormalizedReading[],
  rules: AlertRule[],
  nowMs: number,
  acknowledgedIds: Set<string>,
): AlertEvent[] {
  const events: AlertEvent[] = [];

  // 1. Device disconnection alerts from heartbeat timeout
  for (const device of devices) {
    const disconnectRule = rules.find(
      (r) => r.enabled && r.alertOnDisconnect && (r.source === 'all' || r.source === device.source),
    );
    if (disconnectRule && device.lastCommunicationMs !== null) {
      const elapsedSec = Math.floor((nowMs - device.lastCommunicationMs) / 1000);
      if (elapsedSec > device.heartbeatTimeoutSec) {
        const id = `disconnect-${device.id}-${device.lastCommunicationMs}`;
        events.push({
          id,
          ruleId: disconnectRule.id,
          source: device.source,
          sourceLabel: device.sourceLabel,
          deviceId: device.id,
          deviceName: device.name,
          fieldKey: '_heartbeat',
          fieldLabel: 'Device Heartbeat',
          type: 'disconnection',
          severity: 'critical',
          message: `No telemetry received for ${formatDurationVerbose(elapsedSec)} (timeout ${device.heartbeatTimeoutSec}s).`,
          value: elapsedSec,
          unit: 's',
          timestamp: device.lastCommunicationAt || new Date(nowMs).toISOString(),
          timestampMs: device.lastCommunicationMs,
          acknowledged: acknowledgedIds.has(id),
        });
      }
    }
  }

  // 2. Sensor threshold, missing data, and abnormal spike alerts
  for (const sensor of sensors) {
    const matchingRules = rules.filter(
      (r) =>
        r.enabled &&
        (r.source === 'all' || r.source === sensor.source) &&
        (r.fieldKey === '*' ||
          r.fieldKey.toLowerCase() === sensor.fieldKey.toLowerCase() ||
          r.fieldKey.toLowerCase() === sensor.label.toLowerCase()),
    );

    for (const rule of matchingRules) {
      if (sensor.currentValue === null) {
        if (rule.alertOnMissing) {
          const id = `missing-${rule.id}-${sensor.id}-${sensor.lastUpdatedMs ?? 'none'}`;
          events.push({
            id,
            ruleId: rule.id,
            source: sensor.source,
            sourceLabel: sensor.sourceLabel,
            deviceId: sensor.deviceId,
            deviceName: sensor.deviceName,
            fieldKey: sensor.fieldKey,
            fieldLabel: sensor.label,
            type: 'missing_data',
            severity: 'warning',
            message: `Latest reading for ${sensor.label} is missing or non-numeric.`,
            value: null,
            unit: sensor.unit,
            timestamp: sensor.lastUpdated || new Date(nowMs).toISOString(),
            timestampMs: sensor.lastUpdatedMs ?? nowMs,
            acknowledged: acknowledgedIds.has(id),
          });
        }
        continue;
      }

      if (rule.maxThreshold !== null && sensor.currentValue > rule.maxThreshold) {
        const id = `high-${rule.id}-${sensor.id}-${sensor.lastUpdatedMs}`;
        events.push({
          id,
          ruleId: rule.id,
          source: sensor.source,
          sourceLabel: sensor.sourceLabel,
          deviceId: sensor.deviceId,
          deviceName: sensor.deviceName,
          fieldKey: sensor.fieldKey,
          fieldLabel: sensor.label,
          type: 'high_threshold',
          severity: rule.severity,
          message: `${sensor.label} reading (${sensor.currentValue}${sensor.unit ? ' ' + sensor.unit : ''}) exceeded upper limit (${rule.maxThreshold}).`,
          value: sensor.currentValue,
          unit: sensor.unit,
          timestamp: sensor.lastUpdated || new Date(nowMs).toISOString(),
          timestampMs: sensor.lastUpdatedMs ?? nowMs,
          acknowledged: acknowledgedIds.has(id),
        });
      }

      if (rule.minThreshold !== null && sensor.currentValue < rule.minThreshold) {
        const id = `low-${rule.id}-${sensor.id}-${sensor.lastUpdatedMs}`;
        events.push({
          id,
          ruleId: rule.id,
          source: sensor.source,
          sourceLabel: sensor.sourceLabel,
          deviceId: sensor.deviceId,
          deviceName: sensor.deviceName,
          fieldKey: sensor.fieldKey,
          fieldLabel: sensor.label,
          type: 'low_threshold',
          severity: rule.severity,
          message: `${sensor.label} reading (${sensor.currentValue}${sensor.unit ? ' ' + sensor.unit : ''}) fell below lower limit (${rule.minThreshold}).`,
          value: sensor.currentValue,
          unit: sensor.unit,
          timestamp: sensor.lastUpdated || new Date(nowMs).toISOString(),
          timestampMs: sensor.lastUpdatedMs ?? nowMs,
          acknowledged: acknowledgedIds.has(id),
        });
      }

      // Abnormal spike detection vs rolling mean of last 20 readings
      if (rule.anomalySpikePct !== null && rule.anomalySpikePct > 0) {
        const recentVals = readings
          .filter((r) => r.deviceId === sensor.deviceId && r.values[sensor.fieldKey] !== null)
          .slice(-20)
          .map((r) => r.values[sensor.fieldKey] as number);
        if (recentVals.length >= 5) {
          const baseline = recentVals.slice(0, -1);
          const mean = baseline.reduce((acc, v) => acc + v, 0) / baseline.length;
          if (Math.abs(mean) > 1e-6) {
            const pctDiff = (Math.abs(sensor.currentValue - mean) / Math.abs(mean)) * 100;
            if (pctDiff >= rule.anomalySpikePct) {
              const id = `spike-${rule.id}-${sensor.id}-${sensor.lastUpdatedMs}`;
              events.push({
                id,
                ruleId: rule.id,
                source: sensor.source,
                sourceLabel: sensor.sourceLabel,
                deviceId: sensor.deviceId,
                deviceName: sensor.deviceName,
                fieldKey: sensor.fieldKey,
                fieldLabel: sensor.label,
                type: 'abnormal_reading',
                severity: 'warning',
                message: `${sensor.label} deviated ${pctDiff.toFixed(1)}% from rolling baseline (${mean.toFixed(2)}).`,
                value: sensor.currentValue,
                unit: sensor.unit,
                timestamp: sensor.lastUpdated || new Date(nowMs).toISOString(),
                timestampMs: sensor.lastUpdatedMs ?? nowMs,
                acknowledged: acknowledgedIds.has(id),
              });
            }
          }
        }
      }
    }
  }

  // Deduplicate by id and sort critical first, then newest
  const severityRank: Record<AlertEvent['severity'], number> = { critical: 0, warning: 1, normal: 2 };
  const unique = Array.from(new Map(events.map((e) => [e.id, e])).values());
  unique.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.timestampMs - a.timestampMs);
  return unique;
}

export function formatDurationVerbose(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ${seconds % 60}s`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

export function computeAnalytics(
  readings: NormalizedReading[],
  sensors: SensorSummary[],
  devices: MonitoredDevice[],
): SensorAnalyticsStat[] {
  const deviceMap = new Map(devices.map((d) => [d.id, d]));

  return sensors.map((sensor) => {
    const devReadings = readings
      .filter((r) => r.deviceId === sensor.deviceId)
      .sort((a, b) => a.timestampMs - b.timestampMs);

    const sampleCount = devReadings.length;
    const validVals: number[] = [];
    for (const r of devReadings) {
      const val = r.values[sensor.fieldKey];
      if (val !== null && val !== undefined && Number.isFinite(val)) {
        validVals.push(val);
      }
    }

    const validCount = validVals.length;
    const missingCount = sampleCount - validCount;
    const availabilityPct = sampleCount > 0 ? Number(((validCount / sampleCount) * 100).toFixed(2)) : null;

    let minValue: number | null = null;
    let maxValue: number | null = null;
    let avgValue: number | null = null;
    let stdDev: number | null = null;

    if (validCount > 0) {
      minValue = Math.min(...validVals);
      maxValue = Math.max(...validVals);
      const sum = validVals.reduce((acc, v) => acc + v, 0);
      avgValue = sum / validCount;
      const variance =
        validVals.reduce((acc, v) => acc + Math.pow(v - (avgValue as number), 2), 0) / validCount;
      stdDev = Math.sqrt(variance);
    }

    // Compute real heartbeat continuity uptime if >= 3 samples exist
    let uptimePct: number | null = null;
    let uptimeNote = 'Insufficient heartbeat samples (< 3 readings)';
    const dev = deviceMap.get(sensor.deviceId);
    if (devReadings.length >= 3 && dev) {
      let coveredMs = 0;
      const totalSpanMs = devReadings[devReadings.length - 1].timestampMs - devReadings[0].timestampMs;
      const timeoutMs = dev.heartbeatTimeoutSec * 1000;
      if (totalSpanMs > 0) {
        for (let i = 1; i < devReadings.length; i++) {
          const gap = devReadings[i].timestampMs - devReadings[i - 1].timestampMs;
          coveredMs += Math.min(gap, timeoutMs);
        }
        uptimePct = Number(((coveredMs / totalSpanMs) * 100).toFixed(2));
        uptimeNote = `Calculated across ${devReadings.length} heartbeat intervals`;
      }
    }

    return {
      sensorId: sensor.id,
      fieldKey: sensor.fieldKey,
      label: sensor.label,
      unit: sensor.unit,
      source: sensor.source,
      sourceLabel: sensor.sourceLabel,
      deviceId: sensor.deviceId,
      deviceName: sensor.deviceName,
      sampleCount,
      validCount,
      missingCount,
      availabilityPct,
      currentValue: sensor.currentValue,
      minValue,
      maxValue,
      avgValue,
      stdDev,
      uptimePct,
      uptimeNote,
    };
  });
}

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsvFile(filename: string, headers: string[], rows: unknown[][]): void {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
