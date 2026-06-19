// Vercel Serverless Function — proxy ClickUp com cache Redis (Upstash).
// Browser chama /api/clickup/<path>?<query> → encaminha para
// https://api.clickup.com/api/v2/<path>?<query> com Authorization injetada server-side.
//
// GETs são cacheados por CACHE_TTL segundos. Escritas invalidam o cache da lista afetada.

import { Redis } from '@upstash/redis';

export const maxDuration = 60;

const CACHE_TTL = 300; // 5 minutos

let _redis = null;
function getRedis() {
  if (_redis) return _redis;
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

// Extrai o listId de paths como /list/901326824645/task ou /list/901326824645/task/...
function listIdFromPath(path) {
  const m = path.match(/^\/list\/([^/]+)/);
  return m ? m[1] : null;
}

// Apaga todas as chaves de cache de uma lista (pattern cu:/list/{listId}*)
async function invalidateList(redis, listId) {
  try {
    let cursor = 0;
    do {
      const [next, keys] = await redis.scan(cursor, { match: `cu:/list/${listId}*`, count: 100 });
      if (keys.length) await redis.del(...keys);
      cursor = Number(next);
    } while (cursor !== 0);
  } catch (e) {
    console.warn('cache invalidation error:', e.message);
  }
}

export default async function handler(req, res) {
  const token = process.env.CLICKUP_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'CLICKUP_TOKEN não configurado no servidor.' });
    return;
  }

  const prefix = '/api/clickup';
  const afterPrefix = req.url.startsWith(prefix) ? req.url.slice(prefix.length) : req.url;
  const url = `https://api.clickup.com/api/v2${afterPrefix}`;

  const redis   = getRedis();
  const isGet   = req.method === 'GET';
  const cacheKey = `cu:${afterPrefix}`;

  // ── Cache read (GET only) ──────────────────────────────────────────────────
  if (isGet && redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached != null) {
        res.setHeader('content-type', 'application/json');
        res.setHeader('x-cache', 'HIT');
        res.setHeader('cache-control', 'no-store');
        res.status(200).send(typeof cached === 'string' ? cached : JSON.stringify(cached));
        return;
      }
    } catch (e) {
      console.warn('cache read error:', e.message);
    }
  }

  // ── Proxy para ClickUp ─────────────────────────────────────────────────────
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const body = hasBody && req.body != null
    ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
    : undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await upstream.text();
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('content-type', ct);
    res.setHeader('cache-control', 'no-store');

    // ── Cache write (GET 2xx apenas) ─────────────────────────────────────────
    if (isGet && redis && upstream.status >= 200 && upstream.status < 300) {
      try {
        await redis.set(cacheKey, text, { ex: CACHE_TTL });
        res.setHeader('x-cache', 'MISS');
      } catch (e) {
        console.warn('cache write error:', e.message);
      }
    }

    // ── Invalidação após escrita bem-sucedida ────────────────────────────────
    if (!isGet && redis && upstream.status >= 200 && upstream.status < 300) {
      const listId = listIdFromPath(afterPrefix);
      if (listId) {
        invalidateList(redis, listId); // fire-and-forget
      }
    }

    res.status(upstream.status).send(text);
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      res.status(504).json({ error: 'Timeout ao chamar ClickUp API.' });
    } else {
      res.status(502).json({ error: 'Erro ao chamar ClickUp API.', detail: e.message });
    }
  }
}
