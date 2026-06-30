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
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function isMicrosoftSsoConfigured() {
  return !!import.meta.env.VITE_MICROSOFT_CLIENT_ID;
}

export async function loginWithMicrosoft(returnUrl) {
  const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
  const tenant = import.meta.env.VITE_MICROSOFT_TENANT_ID;
  const redirectUri = window.location.origin + '/auth/microsoft/callback';

  if (!clientId || !tenant) {
    throw new Error('Microsoft SSO non configurato.');
  }

  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  sessionStorage.setItem('ms_state', state);
  sessionStorage.setItem('ms_code_verifier', codeVerifier);
  sessionStorage.setItem('ms_return_url', returnUrl || '/');

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

  window.location.href = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`;
}

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
    throw new Error('Codice di autorizzazione mancante.');
  }

  const savedState = sessionStorage.getItem('ms_state');
  const codeVerifier = sessionStorage.getItem('ms_code_verifier');
  const returnUrl = sessionStorage.getItem('ms_return_url') || '/';

  sessionStorage.removeItem('ms_state');
  sessionStorage.removeItem('ms_code_verifier');
  sessionStorage.removeItem('ms_return_url');

  if (!savedState || state !== savedState) {
    throw new Error('State non valido. Riprova il login.');
  }

  if (!codeVerifier) {
    throw new Error('Sessione scaduta. Riprova il login.');
  }

  const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
  const tenant = import.meta.env.VITE_MICROSOFT_TENANT_ID;
  const redirectUri = window.location.origin + '/auth/microsoft/callback';

  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
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
    throw new Error(tokenData.error_description || 'Impossibile ottenere il token.');
  }

  return { idToken: tokenData.id_token, returnUrl };
}

export async function exchangeIdTokenWithServer(idToken) {
  const res = await fetch('/api/auth/microsoft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || 'Login Microsoft fallito.');
  }

  try {
    localStorage.setItem('marvelops_token', data.token);
    localStorage.setItem('marvelops_current_user', JSON.stringify(data.user));
  } catch (e) {}

  return data.user;
}
