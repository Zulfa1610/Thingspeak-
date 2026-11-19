import type {
  FieldMappingOverride,
  NormalizedReading,
  ThingSpeakChannelInfo,
  ThingSpeakConfig,
} from '../types/iot';

export interface ThingSpeakFetchResult {
  channel: ThingSpeakChannelInfo;
  readings: NormalizedReading[];
  fetchedAt: string;
  latencyMs: number | null;
}

function parseNumericValue(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function fetchThingSpeakData(
  config: ThingSpeakConfig,
  fieldMappings: Record<string, FieldMappingOverride>,
  options?: { results?: number; start?: string; end?: string; days?: number; signal?: AbortSignal },
): Promise<ThingSpeakFetchResult> {
  const params = new URLSearchParams();
  if (config.customUrl.trim()) {
    params.set('customUrl', config.customUrl.trim());
  } else if (config.channelId.trim()) {
    params.set('channelId', config.channelId.trim());
  }

  const results = options?.results ?? config.resultsLimit ?? 200;
  params.set('results', String(results));
  if (options?.start) params.set('start', options.start);
  if (options?.end) params.set('end', options.end);
  if (options?.days) params.set('days', String(options.days));

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 9000);

  if (options?.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(`/api/thingspeak?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || `ThingSpeak request failed (HTTP ${response.status})`);
    }

    if (!data || !data.channel || !Array.isArray(data.feeds)) {
      throw new Error('Malformed ThingSpeak response: missing channel or feeds array.');
    }

    const fieldLabels: Record<string, string> = {};
    for (let i = 1; i <= 8; i++) {
      const key = `field${i}`;
      const rawLabel = data.channel[key];
      if (typeof rawLabel === 'string' && rawLabel.trim()) {
        const mapKey = `thingspeak:${data.channel.id}:${key}`;
        const customLabel = fieldMappings[mapKey]?.label?.trim();
        fieldLabels[key] = customLabel || rawLabel.trim().replace(/\s+/g, ' ');
      }
    }

    const channel: ThingSpeakChannelInfo = {
      id: Number(data.channel.id),
      name: String(data.channel.name || `ThingSpeak Channel ${data.channel.id}`),
      latitude: data.channel.latitude ?? null,
      longitude: data.channel.longitude ?? null,
      createdAt: String(data.channel.created_at || ''),
      updatedAt: String(data.channel.updated_at || ''),
      lastEntryId: data.channel.last_entry_id != null ? Number(data.channel.last_entry_id) : null,
      fieldLabels,
    };

    const seenKeys = new Set<string>();
    const readings: NormalizedReading[] = [];

    for (const feed of data.feeds) {
      if (!feed || !feed.created_at) continue;
      const timestampMs = Date.parse(feed.created_at);
      if (!Number.isFinite(timestampMs)) continue;

      const dedupeKey = `${feed.entry_id ?? ''}_${feed.created_at}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      const values: Record<string, number | null> = {};
      const rawValues: Record<string, string | number | boolean | null> = {};

      for (const fieldKey of Object.keys(fieldLabels)) {
        const rawVal = feed[fieldKey] ?? null;
        rawValues[fieldKey] = rawVal;
        values[fieldKey] = parseNumericValue(rawVal);
      }

      readings.push({
        id: `ts-${channel.id}-${feed.entry_id ?? timestampMs}`,
        source: 'thingspeak',
        sourceLabel: 'ThingSpeak API',
        deviceId: `ts-ch-${channel.id}`,
        deviceName: channel.name,
        entryId: feed.entry_id,
        timestamp: feed.created_at,
        timestampMs,
        values,
        rawValues,
      });
    }

    readings.sort((a, b) => a.timestampMs - b.timestampMs);

    return {
      channel,
      readings,
      fetchedAt: data._meta?.fetchedAt || new Date().toISOString(),
      latencyMs: typeof data._meta?.latencyMs === 'number' ? data._meta.latencyMs : null,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('ThingSpeak request timed out.');
    }
    throw err instanceof Error ? err : new Error('Failed to fetch ThingSpeak data.');
  } finally {
    window.clearTimeout(timeoutId);
  }
}
