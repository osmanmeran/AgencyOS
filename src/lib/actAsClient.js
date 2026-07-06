import { useEffect, useState } from 'react';

// Staff "view portal as a client" selection.
//
// A staff account has no client_id of its own, so the client portal normally
// renders as an empty shell for them. This store lets staff pick a specific
// client (from the CRM) and drive every portal page + b2b read call with that
// client's id, so they experience the portal exactly as that client would.
//
// Persisted in sessionStorage: it survives navigation and reloads within the
// tab, but never leaks across tabs or outlives the session. Real client-portal
// accounts never set this, so it is inert for them.
const KEY = 'marvelops.actAsClientId';
const EVT = 'marvelops:actasclient-change';

/** The client id staff are currently "acting as", or null if none selected. */
export function getActAsClientId() {
  try {
    return sessionStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

/** Sets the "act as" client id and notifies listeners in this tab. */
export function setActAsClientId(id) {
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(EVT));
}

/** Clears the "act as" selection and notifies listeners in this tab. */
export function clearActAsClient() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(EVT));
}

/**
 * Reactive read: re-renders consumers whenever the selection changes (in this
 * tab via the custom event, or another tab via the native storage event).
 */
export function useActAsClientId() {
  const [id, setId] = useState(getActAsClientId);
  useEffect(() => {
    const handler = () => setId(getActAsClientId());
    window.addEventListener(EVT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);
  return id;
}
