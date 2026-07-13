import { getDb, uid } from '../db.js';
import { UnauthorizedError, BadRequestError } from '../middleware/errors.js';
import logger from '../lib/logger.js';
import { getExchangeRate as getStoredExchangeRate, refreshRates, getStoredRates } from './exchangeRates.js';

// Rate lookups now read from the daily snapshot stored in the `exchange_rates`
// table (with a live-API fallback), managed by server/services/exchangeRates.js.
export { refreshRates, getStoredRates };
export const getExchangeRate = getStoredExchangeRate;

/** Record a sent email in `email_logs` (used after sending via Outlook, which has no local log of its own). */
export function logEmail(to, subject, body) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO email_logs (id, to_email, subject, body, status, sent_date) VALUES (?, ?, ?, ?, ?, ?)').run(
    uid(),
    Array.isArray(to) ? to.join(', ') : to,
    subject,
    body || '',
    'sent',
    now,
  );
}

// ── Outlook / Microsoft Graph ──────────────────────────────────────────

const GRAPH_AUTH = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0`;
const GRAPH_API = 'https://graph.microsoft.com/v1.0';
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const SCOPES = 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access';

/** @returns {{connected: boolean, email?: string, name?: string}} Whether this user has linked Outlook. */
export function getOutlookStatus(userId) {
  const db = getDb();
  const row = db.prepare("SELECT data FROM entities WHERE type = 'OutlookToken' AND id = ?").get(userId);
  if (!row) return { connected: false };
  const token = JSON.parse(row.data);
  return { connected: true, email: token.user_email, name: token.user_name };
}

/**
 * Store an Outlook OAuth token obtained client-side (token exchange happens
 * in the browser because Azure's SPA app type requires cross-origin requests),
 * fetching the user's email/name from Graph to display the connection.
 * @returns {Promise<{email: string, name: string}>}
 * @throws {BadRequestError} If no access token was provided.
 */
export async function connectOutlook(userId, { token_data }) {
  const db = getDb();

  // Token exchange is done client-side (SPA type in Azure requires cross-origin requests)
  const tokenData = token_data;
  if (!tokenData?.access_token) throw new BadRequestError('Missing access token');

  let userEmail = '';
  let userName = '';
  try {
    const userResp = await fetch(`${GRAPH_API}/me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (userResp.ok) {
      const userData = await userResp.json();
      userEmail = userData.mail || userData.userPrincipalName || '';
      userName = userData.displayName || '';
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Graph API /me failed');
  }

  // Fall back to a conservative 1h lifetime if Azure omits/mangles expires_in,
  // otherwise Date.now() + NaN produces expires_at = NaN, which the ">" check
  // in getGraphAccessToken always treats as expired, forcing a refresh on
  // every call — and disconnecting the user entirely if no refresh_token
  // was granted (e.g. consent didn't include offline_access).
  const expiresIn = Number.isFinite(tokenData.expires_in) ? tokenData.expires_in : 3600;
  const tokenRecord = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: Date.now() + expiresIn * 1000,
    user_email: userEmail,
    user_name: userName,
  };

  const now = new Date().toISOString();
  const existing = db.prepare("SELECT id FROM entities WHERE type = 'OutlookToken' AND id = ?").get(userId);

  if (existing) {
    db.prepare("UPDATE entities SET data = ?, updated_date = ? WHERE type = 'OutlookToken' AND id = ?").run(
      JSON.stringify(tokenRecord),
      now,
      userId,
    );
  } else {
    db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
      userId,
      'OutlookToken',
      JSON.stringify(tokenRecord),
      now,
      now,
    );
  }

  return { email: userEmail, name: userName };
}

/** Remove a user's stored Outlook token, unlinking their account. */
export function disconnectOutlook(userId) {
  const db = getDb();
  db.prepare("DELETE FROM entities WHERE type = 'OutlookToken' AND id = ?").run(userId);
}

async function getGraphAccessToken(userId) {
  const db = getDb();
  const row = db.prepare("SELECT data FROM entities WHERE type = 'OutlookToken' AND id = ?").get(userId);
  if (!row) throw new Error('Outlook not connected');

  const token = JSON.parse(row.data);
  const now = Date.now();

  if (token.expires_at > now + 60000) {
    return token.access_token;
  }

  if (!token.refresh_token) throw new Error('No refresh token available');
  if (!MICROSOFT_CLIENT_ID) throw new Error('Outlook integration is not configured (missing MICROSOFT_CLIENT_ID)');

  const body = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    refresh_token: token.refresh_token,
    grant_type: 'refresh_token',
    scope: SCOPES,
  });

  const resp = await fetch(`${GRAPH_AUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10000),
  });

  if (!resp.ok) {
    if (resp.status === 400 || resp.status === 401) {
      db.prepare("DELETE FROM entities WHERE type = 'OutlookToken' AND id = ?").run(userId);
      throw new Error('Outlook authorization expired — please reconnect');
    }
    const errData = await resp.json().catch(() => ({}));
    throw new Error(`Token refresh failed: ${errData.error_description || resp.statusText}`);
  }

  const data = await resp.json();
  const updated = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || token.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    user_email: token.user_email,
    user_name: token.user_name,
  };

  db.prepare("UPDATE entities SET data = ?, updated_date = ? WHERE type = 'OutlookToken' AND id = ?").run(
    JSON.stringify(updated),
    new Date().toISOString(),
    userId,
  );

  return updated.access_token;
}

/**
 * Send an email through the user's connected Outlook mailbox via Microsoft Graph.
 * Disconnects the account automatically if Graph reports the auth as expired.
 * @throws {UnauthorizedError|BadRequestError} On missing/expired auth or a Graph API failure.
 */
export async function sendOutlookEmail(userId, { to, subject, body, cc, bcc }) {
  let accessToken;
  try {
    accessToken = await getGraphAccessToken(userId);
  } catch (err) {
    throw new UnauthorizedError(err.message);
  }

  const toRecipients = (Array.isArray(to) ? to : [to]).map((email) => ({
    emailAddress: { address: email.trim() },
  }));
  const ccRecipients = cc
    ? (Array.isArray(cc) ? cc : [cc]).filter(Boolean).map((email) => ({
        emailAddress: { address: email.trim() },
      }))
    : [];
  const bccRecipients = bcc
    ? (Array.isArray(bcc) ? bcc : [bcc]).filter(Boolean).map((email) => ({
        emailAddress: { address: email.trim() },
      }))
    : [];

  const message = {
    message: {
      subject,
      body: { contentType: 'HTML', content: body || '' },
      toRecipients,
      ...(ccRecipients.length > 0 && { ccRecipients }),
      ...(bccRecipients.length > 0 && { bccRecipients }),
    },
    saveToSentItems: true,
  };

  const sendResp = await fetch(`${GRAPH_API}/me/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(10000),
  });

  if (!sendResp.ok) {
    const errText = await sendResp.text();
    logger.error({ status: sendResp.status, body: errText }, 'Graph API sendMail failed');
    if (sendResp.status === 401) {
      disconnectOutlook(userId);
      throw new UnauthorizedError('Outlook authorization expired — please reconnect your account');
    }
    if (sendResp.status === 403) {
      throw new BadRequestError(
        'Outlook permission denied: ensure Mail.Send is granted in Azure AD (API permissions → Grant admin consent)',
      );
    }
    let errMsg = errText;
    try {
      errMsg = JSON.parse(errText)?.error?.message || errText;
    } catch {}
    throw new BadRequestError(`Outlook send failed: ${errMsg}`);
  }

  logEmail(to, subject, body);
}

// ── Supplier Web Search ────────────────────────────────────────────────

// Generic business words that hurt Nominatim matching when the name on file
// doesn't exactly match the mapped POI ("Grand Yavuz Hotel Ltd" vs the OSM
// node "Grand Yavuz"). Stripped to build broader query variants.
const SUPPLIER_NAME_NOISE = new Set([
  'hotel',
  'hotels',
  'otel',
  'oteli',
  'the',
  'co',
  'ltd',
  'llc',
  'inc',
  'tour',
  'tours',
  'travel',
  'turizm',
  'tourism',
  'agency',
  'group',
  'company',
  'suites',
  'resort',
  'spa',
]);

/**
 * Progressively broader Nominatim queries for a supplier: exact "name, city"
 * first, then the bare name, then the name stripped of generic business
 * words, then just its first couple of distinctive words + city.
 * @returns {string[]} Deduped variants, most-specific first (max 4).
 */
function buildQueryVariants(name, city) {
  const clean = name
    .replace(/[^\p{L}\p{N}\s&'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = clean.split(' ');
  const significant = words.filter((w) => !SUPPLIER_NAME_NOISE.has(w.toLowerCase()));
  const simplified = significant.join(' ');

  const variants = [];
  const push = (q) => {
    if (q && q.length >= 3 && !variants.includes(q)) variants.push(q);
  };
  push([clean, city].filter(Boolean).join(', '));
  push(clean);
  if (simplified && simplified !== clean) push([simplified, city].filter(Boolean).join(', '));
  if (significant.length > 2) push([significant.slice(0, 2).join(' '), city].filter(Boolean).join(', '));
  return variants.slice(0, 4);
}

/**
 * Look up candidate supplier details (address, description) by combining
 * Nominatim (OpenStreetMap) geocoding with a Wikipedia full-text search.
 * Nominatim has no fuzzy matching, so instead of a single exact "name, city"
 * lookup this tries progressively broader query variants (dropping the city,
 * then generic words like "Hotel"/"Ltd") until enough candidates accumulate,
 * and returns them all so the user can pick the right one.
 * @returns {Promise<object[]>} Best-effort candidates; empty if all sources fail.
 */
export async function searchSupplier(name, city) {
  const results = [];
  const seenOsm = new Set();
  const MAX_RESULTS = 10;

  const variants = buildQueryVariants(name, city);
  for (let i = 0; i < variants.length && results.length < MAX_RESULTS; i += 1) {
    // Nominatim's usage policy caps clients at 1 request/second.
    if (i > 0) await new Promise((r) => setTimeout(r, 1100));
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(variants[i])}&format=json&limit=10&addressdetails=1`,
        { headers: { 'User-Agent': 'MarvelopsTravelPro/1.0' }, signal: AbortSignal.timeout(8000) },
      );
      const geoData = await geoRes.json();
      if (!Array.isArray(geoData)) continue;
      for (const place of geoData) {
        if (!place.display_name) continue;
        const osmKey = `${place.osm_type}:${place.osm_id}`;
        if (seenOsm.has(osmKey)) continue;
        seenOsm.add(osmKey);
        const addr = place.address || {};
        results.push({
          name: place.name || place.display_name.split(',')[0],
          address: place.display_name,
          phone: '',
          website: '',
          email: '',
          description: place.type
            ? `${place.type} in ${addr.city || addr.town || addr.village || ''}, ${addr.country || ''}`.trim()
            : '',
          rating: 0,
          source: 'nominatim',
          matched_query: variants[i],
          osm_id: place.osm_id,
          osm_type: place.osm_type,
          lat: place.lat,
          lon: place.lon,
        });
        if (results.length >= MAX_RESULTS) break;
      }
    } catch (err) {
      logger.error({ err: err.message, query: variants[i] }, 'Nominatim search failed');
    }
  }

  // Wikipedia full-text search (fuzzy, unlike the old exact-title summary
  // lookup) — returns several candidate pages with a snippet each.
  try {
    const wikiRes = await fetch(
      `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(name)}&limit=3`,
      {
        signal: AbortSignal.timeout(8000),
      },
    );
    if (wikiRes.ok) {
      const wiki = await wikiRes.json();
      for (const page of wiki.pages || []) {
        const snippet = (page.excerpt || '').replace(/<[^>]+>/g, '');
        const description = [page.description, snippet].filter(Boolean).join(' — ');
        if (!description) continue;
        results.push({
          name: page.title,
          address: '',
          phone: '',
          website: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.key)}`,
          email: '',
          description,
          rating: 0,
          source: 'wikipedia',
        });
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Wikipedia search failed');
  }

  return results;
}
