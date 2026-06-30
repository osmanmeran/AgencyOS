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

export function isGoogleSsoConfigured() {
  const configured = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!configured) {
    console.warn('Google SSO not configured. VITE_GOOGLE_CLIENT_ID is missing in .env');
  }
  return configured;
}

export async function loginWithGoogle(returnUrl) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || (window.location.origin + '/mock-login');

  if (!clientId) {
    const errorMsg = 'Google SSO is not configured. Set VITE_GOOGLE_CLIENT_ID in .env';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  console.info('Starting Google OAuth flow', { clientId: clientId.substring(0, 8) + '...', redirectUri });

  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Persist OAuth state across the redirect
  const persist = { state, codeVerifier, redirectUri, clientId, returnUrl, provider: 'google' };
  for (const [key, val] of Object.entries(persist)) {
    try {
      sessionStorage.setItem('oauth_' + key, val);
      localStorage.setItem('oauth_' + key, val);
    } catch (e) {
      console.warn('Failed to persist OAuth state', { key, error: e.message });
    }
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: getCodeChallengeMethod(),
    access_type: 'offline',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  console.info('Redirecting to Google auth', { url: authUrl.substring(0, 100) + '...' });
  window.location.href = authUrl;
}

function getPersisted(key) {
  return sessionStorage.getItem('oauth_' + key) || localStorage.getItem('oauth_' + key);
}

function clearPersisted() {
  const keys = ['state', 'codeVerifier', 'redirectUri', 'clientId', 'returnUrl', 'provider'];
  for (const k of keys) {
    sessionStorage.removeItem('oauth_' + k);
    localStorage.removeItem('oauth_' + k);
  }
}

export async function handleGoogleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  // Not a Google redirect if there's no code/error or provider isn't google
  if ((!code && !error) || getPersisted('provider') !== 'google') return null;

  if (error) {
    console.error('Google OAuth error', { error, errorDescription });
    clearPersisted();
    throw new Error(errorDescription || error || 'Google login failed');
  }

  const savedState = getPersisted('state');
  const codeVerifier = getPersisted('codeVerifier');
  const redirectUri = getPersisted('redirectUri');
  const clientId = getPersisted('clientId');

  // Coarse null check before clearing — state mismatch check comes after
  if (!savedState || !codeVerifier || !redirectUri || !clientId) {
    console.error('Google OAuth session expired or missing state', {
      hasSavedState: !!savedState,
      hasCodeVerifier: !!codeVerifier,
      hasRedirectUri: !!redirectUri,
      hasClientId: !!clientId,
    });
    clearPersisted();
    throw new Error('Google login session expired. Please try again.');
  }

  if (state !== savedState) {
    console.error('Google OAuth state mismatch (CSRF detected)', { state, savedState });
    clearPersisted();
    window.location.href = '/mock-login';
    return null;
  }

  console.info('Google authorization code received, exchanging for tokens');

  // Exchange authorization code for tokens
  const tokenEndpoint = 'https://oauth2.googleapis.com/token';
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  try {
    const tokenRes = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const tokenData = await tokenRes.json();
    
    if (!tokenRes.ok || !tokenData.id_token) {
      console.error('Google token exchange failed', { 
        status: tokenRes.status, 
        error: tokenData.error, 
        errorDescription: tokenData.error_description 
      });
      clearPersisted();
      throw new Error(tokenData.error_description || 'Failed to exchange authorization code');
    }

    console.info('Google token exchange successful');
    // Don't clear persisted data yet — MockLogin still needs returnUrl
    return tokenData.id_token;
  } catch (err) {
    console.error('Google token exchange network error', { message: err.message });
    clearPersisted();
    throw err;
  }
}

export function getGoogleReturnUrl() {
  const url = getPersisted('returnUrl');
  clearPersisted();
  return url || '/';
}

// Direct API call — works independently of the global api-client.js
export async function exchangeGoogleIdToken(idToken) {
  console.info('Exchanging Google ID token for app token');
  
  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      credentials: 'include',
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message || data?.message || 'Google login failed';
      console.error('Google token exchange failed', { status: res.status, message: msg });
      throw new Error(msg);
    }

    console.info('Google authentication successful');

    try {
      localStorage.setItem('marvelops_token', data.token);
      localStorage.setItem('marvelops_current_user', JSON.stringify(data.user));
    } catch (e) {
      console.warn('Failed to store token in localStorage', { error: e.message });
    }

    return data.user;
  } catch (err) {
    console.error('Google token exchange error', { message: err.message, stack: err.stack });
    throw err;
  }
}
