// Google sign-in, redirect + PKCE.
//
// Deliberately does NOT use Google Identity Services: that library loads a
// script from accounts.google.com, which the app's CSP (`scriptSrc: 'self'`,
// server/app.js) blocks. A plain redirect needs no external script and no CSP
// change — a top-level navigation isn't governed by connectSrc, and the token
// exchange happens server-side.

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Whether Google SSO is configured for this environment (client ID present). */
export function isGoogleSsoConfigured() {
  return !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
}

/**
 * Redirect URI for the Google flow. Distinct from the Microsoft one so both
 * providers can be registered side by side without either's callback page
 * having to guess which provider it is handling.
 */
export function getGoogleRedirectUri() {
  return import.meta.env.VITE_GOOGLE_REDIRECT_URI || window.location.origin + '/auth/google/callback';
}

/**
 * Kick off the Google OAuth2 PKCE flow: stash state/verifier/return URL for the
 * callback, then redirect to Google's authorize endpoint.
 * @param {string} [returnUrl] - Where to send the user after login completes.
 */
export async function loginWithGoogle(returnUrl) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Google SSO is not configured.');
  }

  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Mirrors the Microsoft flow's dual write: Safari can drop sessionStorage
  // across a cross-site redirect, so localStorage is the fallback.
  const store = { g_state: state, g_code_verifier: codeVerifier, g_return_url: returnUrl || '/' };
  for (const [k, v] of Object.entries(store)) {
    try {
      sessionStorage.setItem(k, v);
    } catch {}
    try {
      localStorage.setItem(k, v);
    } catch {}
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: getGoogleRedirectUri(),
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    // No refresh token wanted — the id token returned inline is all the server
    // needs, and a refresh token would be one more credential to store.
    access_type: 'online',
    prompt: 'select_account',
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * Handle the redirect back from Google: validate `state`, then hand the
 * authorization code to the backend, which exchanges and verifies it (the
 * exchange needs the client secret, so it cannot happen here).
 * @returns {Promise<{user: object, returnUrl: string}>}
 */
export async function handleGoogleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  if (error) {
    throw new Error(params.get('error_description') || error);
  }
  if (!code) {
    throw new Error('Missing authorization code.');
  }

  const savedState = sessionStorage.getItem('g_state') || localStorage.getItem('g_state');
  const codeVerifier = sessionStorage.getItem('g_code_verifier') || localStorage.getItem('g_code_verifier');
  const returnUrl = sessionStorage.getItem('g_return_url') || localStorage.getItem('g_return_url') || '/';

  for (const k of ['g_state', 'g_code_verifier', 'g_return_url']) {
    try {
      sessionStorage.removeItem(k);
    } catch {}
    try {
      localStorage.removeItem(k);
    } catch {}
  }

  if (!savedState || state !== savedState) {
    throw new Error('Invalid state. Please try signing in again.');
  }
  if (!codeVerifier) {
    throw new Error('Session expired. Please try signing in again.');
  }

  let res;
  try {
    res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, codeVerifier, redirectUri: getGoogleRedirectUri() }),
      credentials: 'include',
    });
  } catch (networkErr) {
    throw new Error(`Network error: could not reach the server. (${networkErr.message})`);
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Server error (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || `Error ${res.status} from server.`);
  }

  try {
    localStorage.setItem('marvelops_current_user', JSON.stringify(data.user));
  } catch {}

  return { user: data.user, returnUrl };
}
