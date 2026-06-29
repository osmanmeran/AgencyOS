import React, { createContext, useContext } from 'react';

const db = globalThis.__B44_DB__ || {
  auth: {
    isAuthenticated: async () => false,
    me: async () => null,
    microsoftLogin: async () => { throw new Error('API client not loaded'); },
    loginViaEmailPassword: async () => { throw new Error('API client not loaded'); },
    logout: () => {},
    redirectToLogin: () => {},
  },
  entities: new Proxy({}, {
    get: () => ({
      filter: async () => [],
      list: async () => [],
      get: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
    }),
  }),
  integrations: {
    Core: {
      UploadFile: async () => ({ file_url: '' }),
      SendEmail: async () => ({}),
      SendSMS: async () => ({}),
      InvokeLLM: async () => ({}),
    },
  },
  appLogs: {
    logUserInApp: async () => {},
  },
};

const DbContext = createContext(null);

export function DbProvider({ children }) {
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb() {
  const ctx = useContext(DbContext);
  if (!ctx) return db;
  return ctx;
}

export { db };
