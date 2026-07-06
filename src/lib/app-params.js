/// <reference types="vite/client" />
const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = /** @type {Storage} */ (windowObj.localStorage);

const MOCK_MODE_KEY = 'marvelops_mock_mode';
/** Whether the app is running against mocked data instead of a real backend. */
export const isMockMode = () => localStorage.getItem(MOCK_MODE_KEY) === 'true';
/** Turns on mock mode (persisted in localStorage). */
export const enableMockMode = () => localStorage.setItem(MOCK_MODE_KEY, 'true');
/** Turns off mock mode (persisted in localStorage). */
export const disableMockMode = () => localStorage.removeItem(MOCK_MODE_KEY);

const toSnakeCase = (str) => {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
};

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
  if (isNode) {
    return defaultValue;
  }
  const storageKey = `marvelops_${toSnakeCase(paramName)}`;
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get(paramName);
  if (removeFromUrl) {
    urlParams.delete(paramName);
    const newUrl = `${window.location.pathname}${
      urlParams.toString() ? `?${urlParams.toString()}` : ''
    }${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  }
  if (searchParam) {
    storage.setItem(storageKey, searchParam);
    return searchParam;
  }
  if (defaultValue !== undefined) {
    storage.setItem(storageKey, defaultValue);
    return defaultValue;
  }
  const storedValue = storage.getItem(storageKey);
  if (storedValue) {
    return storedValue;
  }
  return null;
};

const getAppParams = () => {
  return {
    appId: getAppParamValue('app_id', {
      defaultValue: isMockMode() ? 'mock-app-id' : import.meta.env.VITE_MARVELOPS_APP_ID,
    }),
    serverUrl: getAppParamValue('server_url', {
      defaultValue: isMockMode() ? 'http://localhost:5173' : import.meta.env.VITE_MARVELOPS_BACKEND_URL,
    }),
    token: getAppParamValue('access_token', { removeFromUrl: true }),
    fromUrl: getAppParamValue('from_url', { defaultValue: window.location.href }),
    functionsVersion: getAppParamValue('functions_version'),
  };
};

/**
 * App connection/session params (appId, serverUrl, access token, etc.),
 * resolved once at module load from URL query params, localStorage, or
 * Vite env vars (in that priority order).
 */
export const appParams = {
  ...getAppParams(),
};
