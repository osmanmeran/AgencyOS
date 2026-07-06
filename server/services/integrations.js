import { getDb, uid } from '../db.js';
import { UnauthorizedError, BadRequestError } from '../middleware/errors.js';
import logger from '../lib/logger.js';

let rateCache = { rates: null, timestamp: 0 };
const CACHE_TTL = 3600000;

async function fetchRates() {
  if (rateCache.rates && Date.now() - rateCache.timestamp < CACHE_TTL) {
    return rateCache.rates;
  }
  const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', {
    signal: AbortSignal.timeout(5000),
  });
  const data = await res.json();
  rateCache = { rates: data.usd, timestamp: Date.now() };
  return data.usd;
}

export async function getExchangeRate(from, to) {
  const fromLower = from.toLowerCase();
  const toLower = to.toLowerCase();
  const rates = await fetchRates();
  const fromRate = rates[fromLower];
  const toRate = rates[toLower];
  if (!fromRate || !toRate) {
    throw new BadRequestError(`Unsupported currency: ${!fromRate ? from : to}`);
  }
  return { rate: toRate / fromRate, source: 'fawazahmed0/currency-api', timestamp: new Date().toISOString() };
}

export function logEmail(to, subject, body) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO email_logs (id, to_email, subject, body, status, sent_date) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uid(), Array.isArray(to) ? to.join(', ') : to, subject, body || '', 'sent', now);
}

// ── Outlook / Microsoft Graph ──────────────────────────────────────────

const GRAPH_AUTH = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0`;
const GRAPH_API = 'https://graph.microsoft.com/v1.0';
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const SCOPES = 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access';

export function getOutlookStatus(userId) {
  const db = getDb();
  const row = db.prepare("SELECT data FROM entities WHERE type = 'OutlookToken' AND id = ?").get(userId);
  if (!row) return { connected: false };
  const token = JSON.parse(row.data);
  return { connected: true, email: token.user_email, name: token.user_name };
}

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
    db.prepare("UPDATE entities SET data = ?, updated_date = ? WHERE type = 'OutlookToken' AND id = ?")
      .run(JSON.stringify(tokenRecord), now, userId);
  } else {
    db.prepare("INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)")
      .run(userId, 'OutlookToken', JSON.stringify(tokenRecord), now, now);
  }

  return { email: userEmail, name: userName };
}

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

  db.prepare("UPDATE entities SET data = ?, updated_date = ? WHERE type = 'OutlookToken' AND id = ?")
    .run(JSON.stringify(updated), new Date().toISOString(), userId);

  return updated.access_token;
}

export async function sendOutlookEmail(userId, { to, subject, body, cc, bcc }) {
  let accessToken;
  try {
    accessToken = await getGraphAccessToken(userId);
  } catch (err) {
    throw new UnauthorizedError(err.message);
  }

  const toRecipients = (Array.isArray(to) ? to : [to]).map(email => ({
    emailAddress: { address: email.trim() }
  }));
  const ccRecipients = cc ? (Array.isArray(cc) ? cc : [cc]).filter(Boolean).map(email => ({
    emailAddress: { address: email.trim() }
  })) : [];
  const bccRecipients = bcc ? (Array.isArray(bcc) ? bcc : [bcc]).filter(Boolean).map(email => ({
    emailAddress: { address: email.trim() }
  })) : [];

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
  });

  if (!sendResp.ok) {
    const errText = await sendResp.text();
    logger.error({ status: sendResp.status, body: errText }, 'Graph API sendMail failed');
    if (sendResp.status === 401) {
      disconnectOutlook(userId);
      throw new UnauthorizedError('Outlook authorization expired — please reconnect your account');
    }
    if (sendResp.status === 403) {
      throw new BadRequestError('Outlook permission denied: ensure Mail.Send is granted in Azure AD (API permissions → Grant admin consent)');
    }
    let errMsg = errText;
    try { errMsg = JSON.parse(errText)?.error?.message || errText; } catch {}
    throw new BadRequestError(`Outlook send failed: ${errMsg}`);
  }

  logEmail(to, subject, body);
}

// ── Supplier Web Search ────────────────────────────────────────────────

export async function searchSupplier(name, city) {
  const query = [name, city].filter(Boolean).join(', ');
  const results = [];

  try {
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
      { headers: { 'User-Agent': 'MarvelopsTravelPro/1.0' } }
    );
    const geoData = await geoRes.json();
    if (Array.isArray(geoData)) {
      for (const place of geoData) {
        if (!place.display_name) continue;
        const addr = place.address || {};
        results.push({
          name: place.name || place.display_name.split(',')[0],
          address: place.display_name,
          phone: '', website: '', email: '',
          description: place.type ? `${place.type} in ${addr.city || addr.town || addr.village || ''}, ${addr.country || ''}`.trim() : '',
          rating: 0, source: 'nominatim',
          osm_id: place.osm_id, osm_type: place.osm_type,
          lat: place.lat, lon: place.lon,
        });
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Nominatim search failed');
  }

  try {
    const wikiRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}?redirect=true`
    );
    if (wikiRes.ok) {
      const wiki = await wikiRes.json();
      if (wiki.extract && wiki.extract.length > 50) {
        if (results.length > 0) {
          results[0].description = wiki.extract;
          if (wiki.content_urls?.desktop?.page) results[0].website = wiki.content_urls.desktop.page;
        } else {
          results.push({
            name: wiki.title || name, address: '', phone: '', website: wiki.content_urls?.desktop?.page || '',
            email: '', description: wiki.extract, rating: 0, source: 'wikipedia',
          });
        }
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Wikipedia search failed');
  }

  return results;
}
