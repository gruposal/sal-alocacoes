// Vercel Serverless Function — proxy ClickUp.
// Browser chama /api/clickup/<path-completo>?<query> → reescreve para
// https://api.clickup.com/api/v2/<path>?<query> com Authorization injetada server-side.

export default async function handler(req, res) {
  const token = process.env.CLICKUP_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'CLICKUP_TOKEN não configurado no servidor.' });
    return;
  }

  const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
  const upstreamPath = '/' + segments.join('/');

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue;
    if (Array.isArray(value)) value.forEach(v => params.append(key, v));
    else if (value != null) params.append(key, value);
  }
  const qs = params.toString();
  const url = `https://api.clickup.com/api/v2${upstreamPath}${qs ? '?' + qs : ''}`;

  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const body = hasBody && req.body != null
    ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
    : undefined;

  const upstream = await fetch(url, {
    method: req.method,
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body,
  });

  const text = await upstream.text();
  const ct = upstream.headers.get('content-type');
  if (ct) res.setHeader('content-type', ct);
  res.status(upstream.status).send(text);
}
