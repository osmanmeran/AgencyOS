/** Whether Google SSO is configured for this environment (client ID present). */
export function isGoogleSsoConfigured() {
  return !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
}
