function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Whether Microsoft SSO is configured for this environment (client ID present). */
export function isMicrosoftSsoConfigured() {
  return !!import.meta.env.VITE_MICROSOFT_CLIENT_ID;
}

function getRedirectUri() {
  return import.meta.env.VITE_MICROSOFT_REDIRECT_URI || window.location.origin + '/auth/microsoft/callback';
}

/**
 * Kicks off the Microsoft OAuth2 PKCE login flow: stashes state/verifier/
 * return URL for the callback step, then redirects the browser to the
 * Microsoft authorize endpoint.
 * @param {string} [returnUrl] - Where to send the user after login completes.
 */
export async function loginWithMicrosoft(returnUrl) {
  const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
  const redirectUri = getRedirectUri();

  if (!clientId) {
    throw new Error('Microsoft SSO is not configured.');
  }

  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const msStore = { ms_state: state, ms_code_verifier: codeVerifier, ms_return_url: returnUrl || '/' };
  for (const [k, v] of Object.entries(msStore)) {
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
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    response_mode: 'query',
  });

  window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
}

/**
 * Starts the Microsoft OAuth2 PKCE flow for self-serve workspace **signup**
 * (not an immediate login). The resulting id token is exchanged server-side for
 * a brand-new workspace whose Azure tenant is derived from the token. Uses the
 * `common` authority so any Microsoft org can create a workspace.
 * @param {string} returnUrl - Where to send the user after the workspace is created.
 * @param {{agencyName: string, slug: string, adminName?: string}} signupData
 */
export async function signupWithMicrosoft(returnUrl, signupData) {
  const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
  if (!clientId) {
    throw new Error('Microsoft SSO is not configured.');
  }

  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const msStore = {
    ms_state: state,
    ms_code_verifier: codeVerifier,
    ms_return_url: returnUrl || '/',
    ms_mode: 'signup',
    ms_signup: JSON.stringify({
      agencyName: signupData.agencyName || '',
      slug: signupData.slug || '',
      adminName: signupData.adminName || '',
    }),
  };
  for (const [k, v] of Object.entries(msStore)) {
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
    redirect_uri: getRedirectUri(),
    scope: 'openid profile email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    response_mode: 'query',
  });

  window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
}

/**
 * Handles the redirect back from Microsoft: validates the `state` param
 * against what was stored before redirecting, then exchanges the
 * authorization code for an id token.
 * @returns {Promise<{idToken: string, returnUrl: string}>}
 */
export async function handleMicrosoftCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  if (error) {
    throw new Error(errorDescription || error);
  }

  if (!code) {
    throw new Error('Missing authorization code.');
  }

  const ssState = sessionStorage.getItem('ms_state');
  const lsState = localStorage.getItem('ms_state');
  const savedState = ssState || lsState;
  const codeVerifier = sessionStorage.getItem('ms_code_verifier') || localStorage.getItem('ms_code_verifier');
  const returnUrl = sessionStorage.getItem('ms_return_url') || localStorage.getItem('ms_return_url') || '/';

  for (const k of ['ms_state', 'ms_code_verifier', 'ms_return_url']) {
    try {
      sessionStorage.removeItem(k);
    } catch {}
    try {
      localStorage.removeItem(k);
    } catch {}
  }

  if (!savedState || state !== savedState) {
    throw new Error(`Invalid state. url=${state?.slice(0, 8)} ss=${ssState?.slice(0, 8)} ls=${lsState?.slice(0, 8)}`);
  }

  if (!codeVerifier) {
    throw new Error('Session expired. Please try logging in again.');
  }

  const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
  const redirectUri = getRedirectUri();

  // Multi-tenant app: exchange the code at the /common endpoint so users
  // from any Microsoft org can authenticate (their home tenant is embedded
  // in the resulting id_token - the server validates it against the workspace).
  const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      scope: 'openid profile email',
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.id_token) {
    throw new Error(tokenData.error_description || 'Could not obtain the token.');
  }

  return { idToken: tokenData.id_token, returnUrl };
}

/** Sends the Microsoft id token to the backend to establish a session, returning the resolved app user. */
export async function exchangeIdTokenWithServer(idToken) {
  let res;
  try {
    res = await fetch('/api/auth/microsoft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
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
    // The server responded with non-JSON text (serverless crash)
    throw new Error(`Server error (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || `Error ${res.status} from server.`);
  }

  try {
    localStorage.setItem('marvelops_current_user', JSON.stringify(data.user));
  } catch {}

  return data.user;
}
