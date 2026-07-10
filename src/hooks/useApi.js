import { useState } from 'react';
import { getCsrfToken } from '@/lib/csrf';

export function useApi() {
  const [loading, setLoading] = useState(false);

  async function request(path, opts = {}) {
    setLoading(true);
    const csrfToken = getCsrfToken();
    const headers = {
      ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...opts.headers,
    };
    try {
      const res = await fetch(path, { credentials: 'include', ...opts, headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error?.message || body.error || 'Request failed');
      }
      return res.headers.get('content-type')?.includes('application/json') ? res.json() : res;
    } finally {
      setLoading(false);
    }
  }

  return { request, loading };
}
