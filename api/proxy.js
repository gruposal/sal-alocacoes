// Vercel Serverless Function — proxy ClickUp.
// Browser chama /api/clickup/v2/<path>?<query>
// Esta função recebe a requisição via rewrite em vercel.json e encaminha para
// https://api.clickup.com/api/v2/<path>?<query> com Authorization injetada server-side.

export default async function handler(req, res) {
  const token = process.env.CLICKUP_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'CLICKUP_TOKEN não configurado no servidor.' });
    return;
  }

  // req.url = /api/clickup/<path>?<qs>  →  extrai tudo após /api/clickup e prepende /api/v2
  const prefix = '/api/clickup';
  const afterPrefix = req.url.startsWith(prefix) ? req.url.slice(prefix.length) : req.url;
  const url = `https://api.clickup.com/api/v2${afterPrefix}`;

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
