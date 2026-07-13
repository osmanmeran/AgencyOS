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

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

// OSM tag keys (in priority order) that map onto our supplier contact fields.
// Nominatim's summary response omits most of these, so we re-fetch the full
// node/way/relation via Overpass to populate them for the "Apply" autofill.
const OSM_TAG_MAP = {
  phone: ['contact:phone', 'phone', 'contact:mobile', 'mobile', 'contact:fax', 'fax'],
  website: ['contact:website', 'website', 'url', 'contact:facebook', 'facebook', 'contact:link'],
  email: ['contact:email', 'email', 'contact:instagram', 'instagram'],
  brand: ['brand', 'operator', 'official_name', 'name:en'],
  opening_hours: ['opening_hours'],
};

/**
 * Re-fetch the detailed OSM tags for candidate places (matched by osm_type +
 * osm_id) via a single Overpass query, filling phone/website/email/brand/
 * opening_hours that Nominatim leaves blank. Best-effort: logs and skips on
 * any failure so the rest of the search is unaffected.
 * @param {object[]} hits Nominatim results (mutated in place).
 */
async function enrichOsmContacts(hits) {
  const needy = hits.filter((h) => h.osm_id && h.osm_type && !(h.phone && h.website && h.email));
  if (!needy.length) return;
  const statements = needy.map((h) => `${h.osm_type}(id:${h.osm_id});`).join('\n');
  const query = `[out:json][timeout:25];\n(\n${statements}\n);\nout tags;`;
  try {
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'MarvelopsTravelPro/1.0',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return;
    const data = await res.json();
    const byKey = new Map();
    for (const el of data.elements || []) byKey.set(`${el.type}:${el.id}`, el.tags || {});
    for (const h of needy) {
      const tags = byKey.get(`${h.osm_type}:${h.osm_id}`);
      if (!tags) continue;
      for (const [field, keys] of Object.entries(OSM_TAG_MAP)) {
        if (h[field]) continue;
        const val = keys.map((k) => tags[k]).find(Boolean);
        if (val) h[field] = val;
      }
      // Build a cleaner structured address from addr:* tags when present.
      if (!h.address && (tags['addr:street'] || tags['addr:city'])) {
        h.address = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city'], tags['addr:postcode']]
          .filter(Boolean)
          .join(', ');
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Overpass enrichment failed');
  }
}

/**
 * Wikidata structured-entity search: finds candidate organisations/places by
 * name (+city) and pulls their official website (P856), phone (P1329) and
 * email (P968) claims. Catches suppliers Nominatim may miss and supplies the
 * contact fields OSM summaries lack. Best-effort.
 * @returns {Promise<object[]>} Candidate suppliers (may be empty).
 */
async function searchWikidata(name, city) {
  const out = [];
  const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
    [name, city].filter(Boolean).join(' '),
  )}&language=en&format=json&limit=5`;
  let res;
  try {
    res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'MarvelopsTravelPro/1.0' },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Wikidata search failed');
    return out;
  }
  if (!res.ok) return out;
  const data = await res.json();
  const entities = (data.search || []).slice(0, 3);
  if (!entities.length) return out;

  const ids = entities.map((e) => e.id).join('|');
  let detail;
  try {
    const detailRes = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}&props=claims|descriptions&languages=en&format=json`,
      { headers: { 'User-Agent': 'MarvelopsTravelPro/1.0' }, signal: AbortSignal.timeout(8000) },
    );
    if (!detailRes.ok) return out;
    detail = await detailRes.json();
  } catch (err) {
    logger.error({ err: err.message }, 'Wikidata detail fetch failed');
    return out;
  }

  const getClaim = (claims, pid) => {
    const arr = claims[pid];
    if (!arr || !arr.length) return '';
    const v = arr[0].mainsnak?.datavalue?.value;
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && v.id) return `https://www.wikidata.org/wiki/${v.id}`;
    return '';
  };
  // P18 is a Commons filename; build a direct image URL from it.
  const getImage = (claims) => {
    const arr = claims.P18;
    if (!arr || !arr.length) return '';
    const raw = arr[0].mainsnak?.datavalue?.value;
    if (typeof raw !== 'string') return '';
    const file = raw.replace(/^File:/i, '').trim();
    return file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}` : '';
  };

  for (const e of entities) {
    const ent = detail.entities?.[e.id];
    if (!ent) continue;
    const claims = ent.claims || {};
    const website = getClaim(claims, 'P856');
    const phone = getClaim(claims, 'P1329');
    const email = getClaim(claims, 'P968');
    const photo = getImage(claims);
    const description = ent.descriptions?.en?.value || e.description || '';
    if (!website && !phone && !email && !photo && !description) continue;
    out.push({
      name: e.label || e.match?.text?.replace(/<[^>]+>/g, '') || '',
      address: '',
      phone,
      website,
      email,
      description,
      rating: 0,
      source: 'wikidata',
      brand: '',
      opening_hours: '',
      photo,
    });
  }
  return out;
}

const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/';

// Photon returns OSM types as single letters; Overpass wants the full word.
const PHOTON_OSM_TYPE = { N: 'node', W: 'way', R: 'relation' };

/**
 * Photon (komoot) geocoding — an OSM-based search engine with better fuzzy
 * matching/relevance than Nominatim. Returns candidate places carrying their
 * OSM ids so they can be merged with and enriched alongside the Nominatim
 * hits (they share the same OSM id space). Key-less; best-effort.
 * @returns {Promise<object[]>} Candidate OSM hits (may be empty).
 */
async function searchPhoton(name, city) {
  const hits = [];
  const q = [name, city].filter(Boolean).join(' ');
  if (!q) return hits;
  try {
    const res = await fetch(`${PHOTON_ENDPOINT}?q=${encodeURIComponent(q)}&limit=10`, {
      headers: { 'User-Agent': 'MarvelopsTravelPro/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return hits;
    const data = await res.json();
    for (const f of data.features || []) {
      const p = f.properties || {};
      if (!p.name) continue;
      const coords = f.geometry?.coordinates;
      hits.push({
        name: p.name,
        address: [p.housenumber, p.street, p.city, p.postcode, p.country].filter(Boolean).join(', '),
        phone: '',
        website: '',
        email: '',
        description: p.osm_value ? `${p.osm_value} in ${p.city || ''}, ${p.country || ''}`.trim() : '',
        rating: 0,
        source: 'openstreetmap',
        matched_query: q,
        osm_id: p.osm_id,
        osm_type: PHOTON_OSM_TYPE[p.osm_type] || '',
        lat: coords ? coords[1] : '',
        lon: coords ? coords[0] : '',
        brand: '',
        opening_hours: '',
        photo: '',
      });
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Photon search failed');
  }
  return hits;
}

/**
 * Yelp Fusion business search — the richest free source for supplier details
 * (phone, rating, review count, categories, address). Requires YELP_API_KEY;
 * returns [] if unset so the rest of the search is unaffected. Note Yelp only
 * exposes its own business page URL, not the official website. Best-effort.
 * @returns {Promise<object[]>} Candidate businesses (may be empty).
 */
async function searchYelp(name, city) {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey || !city) return [];
  const out = [];
  try {
    const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(
      name,
    )}&location=${encodeURIComponent(city)}&limit=5`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return out;
    const data = await res.json();
    for (const b of data.businesses || []) {
      const loc = b.location || {};
      const cats = (b.categories || [])
        .map((c) => c.title)
        .filter(Boolean)
        .join(', ');
      const ratingStr = typeof b.rating === 'number' ? `⭐ ${b.rating} (${b.review_count || 0} reviews)` : '';
      out.push({
        name: b.name || '',
        address: (loc.display_address || []).join(', '),
        phone: b.display_phone || b.phone || '',
        website: b.url || '',
        email: '',
        description: [cats, ratingStr].filter(Boolean).join(' — ') || 'Yelp',
        rating: typeof b.rating === 'number' ? b.rating : 0,
        source: 'yelp',
        brand: '',
        opening_hours: '',
        photo: b.image_url || '',
        lat: b.coordinates?.latitude ?? null,
        lon: b.coordinates?.longitude ?? null,
      });
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Yelp search failed');
  }
  return out;
}

/**
 * Look up candidate supplier details by combining several open, key-less
 * (or key-optional) data sources so the user gets both more candidates and
 * more fillable fields:
 *   1. Nominatim (OpenStreetMap) geocoding — progressively broader
 *      "name, city" → bare name → stripped-name variants.
 *   2. Photon (komoot) — OSM-based geocoding with better fuzzy matching;
 *      shares the OSM id space with Nominatim so hits are deduped.
 *   3. OSM Overpass — enriches the OSM hits with structured contact tags
 *      (phone, website, email, brand, opening hours) the geocoders omit.
 *   4. Wikipedia full-text search — fuzzy description + Wikipedia link.
 *   5. Wikidata — structured entity data (official site, phone, email) for
 *      candidates OSM may miss entirely.
 *   6. Yelp Fusion (optional, needs YELP_API_KEY) — phone, rating, reviews,
 *      categories, and address for the richest supplier profile.
 * Every source is best-effort: a failure in any one is logged and skipped.
 * @returns {Promise<object[]>} Best-effort candidates; empty if all sources fail.
 */
export async function searchSupplier(name, city) {
  const results = [];
  const seen = new Set();
  const seenOsm = new Set();
  const osmHits = [];
  const MAX_RESULTS = 14;
  const pushResult = (r) => {
    const key = `${r.source}:${r.name}:${r.website || r.address || ''}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    results.push(r);
  };
  const pushOsmHit = (h) => {
    if (h.osm_id && h.osm_type) {
      const k = `${h.osm_type}:${h.osm_id}`;
      if (seenOsm.has(k)) return;
      seenOsm.add(k);
    }
    osmHits.push(h);
  };

  const variants = buildQueryVariants(name, city);

  // 1) Nominatim geocoding.
  for (let i = 0; i < variants.length && osmHits.length < MAX_RESULTS; i += 1) {
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
        const addr = place.address || {};
        pushOsmHit({
          name: place.name || place.display_name.split(',')[0],
          address: place.display_name,
          phone: '',
          website: '',
          email: '',
          description: place.type
            ? `${place.type} in ${addr.city || addr.town || addr.village || ''}, ${addr.country || ''}`.trim()
            : '',
          rating: 0,
          source: 'openstreetmap',
          matched_query: variants[i],
          osm_id: place.osm_id,
          osm_type: place.osm_type,
          lat: place.lat,
          lon: place.lon,
          brand: '',
          opening_hours: '',
          photo: '',
        });
        if (osmHits.length >= MAX_RESULTS) break;
      }
    } catch (err) {
      logger.error({ err: err.message, query: variants[i] }, 'Nominatim search failed');
    }
  }

  // 2) Photon — better fuzzy matching, deduped against Nominatim via OSM id.
  try {
    const photon = await searchPhoton(name, city);
    photon.forEach(pushOsmHit);
  } catch (err) {
    logger.error({ err: err.message }, 'Photon search failed');
  }

  // 3) Enrich OSM hits (Nominatim + Photon) with detailed contact tags.
  await enrichOsmContacts(osmHits);
  osmHits.forEach(pushResult);

  // 4) Wikipedia full-text search (fuzzy) — returns several candidate pages.
  try {
    const wikiRes = await fetch(
      `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(name)}&limit=3`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (wikiRes.ok) {
      const wiki = await wikiRes.json();
      for (const page of wiki.pages || []) {
        const snippet = (page.excerpt || '').replace(/<[^>]+>/g, '');
        const description = [page.description, snippet].filter(Boolean).join(' — ');
        if (!description) continue;
        pushResult({
          name: page.title,
          address: '',
          phone: '',
          website: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.key)}`,
          email: '',
          description,
          rating: 0,
          source: 'wikipedia',
          brand: '',
          opening_hours: '',
          photo: '',
        });
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Wikipedia search failed');
  }

  // 5) Wikidata structured entity search (official site / phone / email).
  try {
    const wd = await searchWikidata(name, city);
    wd.forEach(pushResult);
  } catch (err) {
    logger.error({ err: err.message }, 'Wikidata search failed');
  }

  // 6) Yelp Fusion (requires YELP_API_KEY; no-op if unset).
  try {
    const yelp = await searchYelp(name, city);
    yelp.forEach(pushResult);
  } catch (err) {
    logger.error({ err: err.message }, 'Yelp search failed');
  }

  return results.slice(0, MAX_RESULTS);
}
