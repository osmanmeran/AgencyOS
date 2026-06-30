/// <reference types="vite/client" />
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

async function generateCodeChallenge(verifier) {
  if (globalThis.crypto && globalThis.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return verifier;
}

function getCodeChallengeMethod() {
  if (globalThis.crypto && globalThis.crypto.subtle) return 'S256';
  return 'plain';
}

export function isMicrosoftSsoConfigured() {
  const configured = !!import.meta.env.VITE_MICROSOFT_CLIENT_ID;
  if (!configured) {
    console.warn('Microsoft SSO not configured. VITE_MICROSOFT_CLIENT_ID is missing in .env');
  }
  return configured;
}

export async function loginWithMicrosoft(returnUrl) {
  const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
  const tenant = import.meta.env.VITE_MICROSOFT_TENANT || 'common';
  const redirectUri = import.meta.env.VITE_MICROSOFT_REDIRECT_URI || (window.location.origin + '/mock-login');

  if (!clientId) {
    const errorMsg = 'Microsoft SSO is not configured. Set VITE_MICROSOFT_CLIENT_ID in .env';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  console.info('Starting Microsoft OAuth flow', { clientId: clientId.substring(0, 8) + '...', tenant, redirectUri });

  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Persist OAuth state across the redirect
  const persist = { state, codeVerifier, redirectUri, clientId, tenant, returnUrl };
  for (const [key, val] of Object.entries(persist)) {
    try {
      sessionStorage.setItem('msal_' + key, val);
      localStorage.setItem('msal_' + key, val);
    } catch (e) {
      console.warn('Failed to persist OAuth state', { key, error: e.message });
    }
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'openid profile email offline_access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: getCodeChallengeMethod(),
    response_mode: 'query',
  });

  const authUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`;
  console.info('Redirecting to Microsoft auth', { url: authUrl.substring(0, 100) + '...' });
  window.location.href = authUrl;
}

function getPersisted(key) {
  return sessionStorage.getItem('msal_' + key) || localStorage.getItem('msal_' + key);
}

function clearPersisted() {
  const keys = ['state', 'codeVerifier', 'redirectUri', 'clientId', 'tenant', 'returnUrl'];
  for (const k of keys) {
    sessionStorage.removeItem('msal_' + k);
    localStorage.removeItem('msal_' + k);
  }
}

export async function handleMicrosoftRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  // Not a Microsoft redirect if there's no code/error
  if (!code && !error) return null;

  if (error) {
    console.error('Microsoft OAuth error', { error, errorDescription });
    clearPersisted();
    throw new Error(errorDescription || error || 'Microsoft login failed');
  }

  const savedState = getPersisted('state');
  const codeVerifier = getPersisted('codeVerifier');
  const redirectUri = getPersisted('redirectUri');
  const clientId = getPersisted('clientId');
  const tenant = getPersisted('tenant');

  // Coarse null check before clearing — state mismatch check comes after
  if (!savedState || !codeVerifier || !redirectUri || !clientId) {
    console.error('Microsoft OAuth session expired or missing state', {
      hasSavedState: !!savedState,
      hasCodeVerifier: !!codeVerifier,
      hasRedirectUri: !!redirectUri,
      hasClientId: !!clientId,
    });
    clearPersisted();
    throw new Error('Microsoft login session expired. Please try again.');
  }

  if (state !== savedState) {
    console.error('Microsoft OAuth state mismatch (CSRF detected)', { state, savedState });
    clearPersisted();
    window.location.href = '/mock-login';
    return null;
  }

  console.info('Microsoft authorization code received, exchanging for tokens');

  // Exchange authorization code for tokens
  const tokenEndpoint = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    scope: 'openid profile email offline_access',
  });

  try {
    const tokenRes = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const tokenData = await tokenRes.json();
    
    if (!tokenRes.ok || !tokenData.id_token) {
      console.error('Token exchange failed', { 
        status: tokenRes.status, 
        error: tokenData.error, 
        errorDescription: tokenData.error_description 
      });
      clearPersisted();
      throw new Error(tokenData.error_description || 'Failed to exchange authorization code');
    }

    console.info('Token exchange successful');
    // Don't clear persisted data yet — MockLogin still needs returnUrl
    // It will call clearPersisted after consuming it
    return tokenData.id_token;
  } catch (err) {
    console.error('Token exchange network error', { message: err.message });
    clearPersisted();
    throw err;
  }
}

export function getMicrosoftReturnUrl() {
  const url = getPersisted('returnUrl');
  clearPersisted();
  return url || '/';
}

// Direct API call — works independently of the global api-client.js
export async function exchangeIdToken(idToken) {
  console.info('Exchanging Microsoft ID token for app token');
  
  try {
    const res = await fetch('/api/auth/microsoft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      credentials: 'include',
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message || data?.message || 'Microsoft login failed';
      console.error('Microsoft token exchange failed', { status: res.status, message: msg });
      throw new Error(msg);
    }

    console.info('Microsoft authentication successful');

    try {
      localStorage.setItem('marvelops_token', data.token);
      localStorage.setItem('marvelops_current_user', JSON.stringify(data.user));
    } catch (e) {
      console.warn('Failed to store token in localStorage', { error: e.message });
    }

    return data.user;
  } catch (err) {
    console.error('Token exchange error', { message: err.message, stack: err.stack });
    throw err;
  }
}
