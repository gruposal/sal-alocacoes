// Vercel Serverless Function — proxy ClickUp com cache HTTP no edge.
// Browser chama /api/clickup/<path>?<query> → encaminha para
// https://api.clickup.com/api/v2/<path>?<query> com Authorization server-side.
//
// Cache strategy:
//   GET  sem filtro (people/projects)  → 1h   (referência, raramente muda)
//   GET  com filtro de ano+semana      → 5min  (leituras de semana corrente)
//   GET  com filtro só de ano          → 15min (loadLastYear / dashboard)
//   GET  genérico                      → 2min
//   POST/PUT/DELETE                    → sem cache + bust via Vercel Cache-Control

const TTL = {
  reference: 3600,   // 1h  — listas de pessoas e projetos
  week:      300,    // 5min — loadForWeek
  year:      900,    // 15min — loadLastYear
  default:   120,    // 2min
};

function getTtl(url) {
  const qs = url.includes('?') ? url.split('?')[1] : '';
  if (qs.includes('semana_num') || qs.includes('iso_week')) return TTL.week;
  if (qs.includes('ano') || qs.includes('year'))            return TTL.year;
  if (!qs.includes('custom_fields'))                        return TTL.reference;
  return TTL.default;
}

export default async function handler(req, res) {
  const token = process.env.CLICKUP_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'CLICKUP_TOKEN não configurado no servidor.' });
    return;
  }

  const prefix = '/api/clickup';
  // Remove parâmetro interno _bust (usado para invalidar cache do browser)
  const rawUrl = req.url.replace(/[?&]_bust=[^&]*/g, '').replace(/\?$/, '');
  const afterPrefix = rawUrl.startsWith(prefix) ? rawUrl.slice(prefix.length) : rawUrl;
  const url = `https://api.clickup.com/api/v2${afterPrefix}`;

  const isRead = ['GET', 'HEAD'].includes(req.method);
  const body = !isRead && req.body != null
    ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
    : undefined;

  const upstream = await fetch(url, {
    method: req.method,
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body,
  });

  const text = await upstream.text();
  const ct = upstream.headers.get('content-type');
  if (ct) res.setHeader('content-type', ct);

  if (isRead && upstream.ok) {
    const ttl = getTtl(afterPrefix);
    // s-maxage: cache no edge Vercel; stale-while-revalidate: serve stale enquanto revalida
    res.setHeader('cache-control', `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`);
  } else {
    res.setHeader('cache-control', 'no-store');
  }

  res.status(upstream.status).send(text);
}
