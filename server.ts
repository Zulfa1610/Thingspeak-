import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DEFAULT_THINGSPEAK_CHANNEL_ID = process.env.THINGSPEAK_CHANNEL_ID || '3585272';
const DEFAULT_THINGSPEAK_READ_KEY = process.env.THINGSPEAK_READ_API_KEY || '1TLQM4WCHGAOOP93';

function buildSafeThingSpeakUrl(query: Record<string, unknown>): string {
  const customUrl = typeof query.customUrl === 'string' ? query.customUrl.trim() : '';

  if (customUrl) {
    let parsed: URL;
    try {
      parsed = new URL(customUrl);
    } catch {
      throw new Error('Invalid custom ThingSpeak URL format.');
    }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'api.thingspeak.com') {
      throw new Error('Custom URL must use https://api.thingspeak.com.');
    }
    // Preserve optional query overrides if provided
    if (typeof query.results === 'string' && /^\d+$/.test(query.results)) {
      parsed.searchParams.set('results', String(Math.min(8000, Math.max(1, Number(query.results)))));
    }
    if (typeof query.start === 'string' && query.start) {
      parsed.searchParams.set('start', query.start);
    }
    if (typeof query.end === 'string' && query.end) {
      parsed.searchParams.set('end', query.end);
    }
    if (typeof query.days === 'string' && /^\d+$/.test(query.days)) {
      parsed.searchParams.set('days', query.days);
    }
    return parsed.toString();
  }

  const rawChannelId = typeof query.channelId === 'string' && query.channelId.trim()
    ? query.channelId.trim()
    : DEFAULT_THINGSPEAK_CHANNEL_ID;

  if (!/^\d+$/.test(rawChannelId)) {
    throw new Error('ThingSpeak channel ID must be numeric.');
  }

  const url = new URL(`https://api.thingspeak.com/channels/${rawChannelId}/feeds.json`);
  if (rawChannelId === DEFAULT_THINGSPEAK_CHANNEL_ID && DEFAULT_THINGSPEAK_READ_KEY) {
    url.searchParams.set('api_key', DEFAULT_THINGSPEAK_READ_KEY);
  }

  const results = typeof query.results === 'string' && /^\d+$/.test(query.results)
    ? Math.min(8000, Math.max(1, Number(query.results)))
    : 200;
  url.searchParams.set('results', String(results));

  if (typeof query.start === 'string' && query.start) {
    url.searchParams.set('start', query.start);
  }
  if (typeof query.end === 'string' && query.end) {
    url.searchParams.set('end', query.end);
  }
  if (typeof query.days === 'string' && /^\d+$/.test(query.days)) {
    url.searchParams.set('days', query.days);
  }

  return url.toString();
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/thingspeak', async (req, res) => {
    const startedAt = Date.now();
    try {
      const targetUrl = buildSafeThingSpeakUrl(req.query as Record<string, unknown>);
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        res.status(response.status).json({
          error: `ThingSpeak API returned HTTP ${response.status}`,
          details: text.slice(0, 300),
        });
        return;
      }

      const payload = await response.json();
      res.json({
        ...payload,
        _meta: {
          fetchedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
          channelId: payload?.channel?.id ?? null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown ThingSpeak fetch failure';
      const isTimeout = message.toLowerCase().includes('timeout') || message.toLowerCase().includes('abort');
      res.status(isTimeout ? 504 : 502).json({
        error: isTimeout ? 'ThingSpeak request timed out after 8s' : message,
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production' || fs.existsSync(path.resolve(__dirname, 'dist/index.html'));

  if (!isProd || process.env.SERVE_VITE_DEV === 'true') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NexusGrid IoT Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
