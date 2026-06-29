import { useState } from 'react';

function getToken() {
  try {
    const stored = localStorage.getItem('b44_user');
    if (!stored) return null;
    return JSON.parse(stored).token;
  } catch { return null; }
}

export function useApi() {
  const [loading, setLoading] = useState(false);

  async function request(path, opts = {}) {
    setLoading(true);
    const token = getToken();
    const headers = { ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers };
    try {
      const res = await fetch(path, { ...opts, headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error?.message || body.error || 'Request failed');
      }
      return res.headers.get('content-type')?.includes('application/json') ? res.json() : res;
    } finally { setLoading(false); }
  }

  return { request, loading };
}
