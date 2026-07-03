import { db } from '@/lib/DbContext';
import { useEffect, useState } from 'react';

// Resolves the logged-in client-portal user's linked Client (CRM) record.
// Prefers the authoritative client_id carried in the JWT; falls back to
// matching the login email against Client.email for any account that
// predates client_id being wired through. Matching by email alone is
// fragile — it silently fails (client stays null, pages hang on a loading
// skeleton forever) whenever the portal login email differs from the CRM
// contact's email, which is a completely normal setup.
export function useMyClient() {
  const [client, setClient] = useState(null);

  useEffect(() => {
    let cancelled = false;
    db.auth.me().then(async (user) => {
      let resolved = null;
      if (user.client_id) {
        resolved = await db.entities.Client.get(user.client_id).catch(() => null);
      }
      if (!resolved && user.email) {
        const clients = await db.entities.Client.filter({ email: user.email });
        resolved = clients[0] || null;
      }
      if (!cancelled) setClient(resolved);
    });
    return () => { cancelled = true; };
  }, []);

  return client;
}
