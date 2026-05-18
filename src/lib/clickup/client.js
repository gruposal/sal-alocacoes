// Browser não fala com api.clickup.com diretamente — passa pelo proxy /api/clickup
// (Vercel Serverless Function), que injeta a Authorization server-side.
const BASE_URL = '/api/clickup';

export async function cuFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
    await delay(retryAfter * 1000);
    return cuFetch(path, options);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ClickUp ${res.status}: ${text}`);
  }

  return res.json();
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
