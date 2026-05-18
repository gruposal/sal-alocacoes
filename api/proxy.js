// Vercel Serverless Function — proxy ClickUp.
// Browser chama /api/clickup/<path>?<query> → encaminha para
// https://api.clickup.com/api/v2/<path>?<query> com Authorization injetada server-side.
// Cache é gerenciado pelo browser via localStorage (ts:cache:*) no app React.

export default async function handler(req, res) {
  const token = process.env.CLICKUP_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'CLICKUP_TOKEN não configurado no servidor.' });
    return;
  }

  const prefix = '/api/clickup';
  const afterPrefix = req.url.startsWith(prefix) ? req.url.slice(prefix.length) : req.url;
  const url = `https://api.clickup.com/api/v2${afterPrefix}`;

  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const body = hasBody && req.body != null
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
  res.setHeader('cache-control', 'no-store');
  res.status(upstream.status).send(text);
}
