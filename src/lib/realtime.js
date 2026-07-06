// Single shared WebSocket connection for the whole app (notifications, entity
// sync, etc.), so multiple features don't each open their own socket to /ws.

const listeners = new Set();
let ws = null;
let reconnectTimer = null;
let closedManually = false;
let refCount = 0;

function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  try {
    ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      listeners.forEach((fn) => {
        try {
          fn(data);
        } catch {
          /* ignore listener errors */
        }
      });
    };
    ws.onclose = () => {
      ws = null;
      if (!closedManually && refCount > 0) reconnectTimer = setTimeout(connect, 3000);
    };
  } catch {
    if (refCount > 0) reconnectTimer = setTimeout(connect, 3000);
  }
}

/** Call when a consumer needs the connection open; pairs with {@link releaseRealtime}. */
export function acquireRealtime() {
  refCount += 1;
  closedManually = false;
  if (!ws) connect();
}

/** Call on consumer unmount. Only tears the socket down once nobody needs it. */
export function releaseRealtime() {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0) {
    closedManually = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      ws.close();
      ws = null;
    }
  }
}

/**
 * Subscribes to incoming messages.
 * @returns {Function} Unsubscribe function.
 */
export function onRealtimeMessage(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}
