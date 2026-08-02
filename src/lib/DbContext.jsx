import React, { createContext, useContext } from 'react';

const db = globalThis.__B44_DB__ || {
  auth: {
    isAuthenticated: async () => false,
    me: async () => null,
    users: async () => [],
    createUser: async () => ({}),
    updateUser: async () => ({}),
    deleteUser: async () => ({}),
    invite: async () => ({}),
    acceptInvite: async () => {
      throw new Error('API client not loaded');
    },
    getClientPortal: async () => ({}),
    grantClientPortal: async () => ({}),
    revokeClientPortal: async () => ({}),
    loginViaEmailPassword: async () => {
      throw new Error('API client not loaded');
    },
    updateMe: async () => ({}),
    logout: () => {},
    redirectToLogin: () => {},
  },
  entities: new Proxy(
    {},
    {
      get: () => ({
        filter: async () => [],
        list: async () => [],
        get: async () => null,
        create: async () => ({}),
        bulkCreate: async () => [],
        update: async () => ({}),
        delete: async () => ({}),
        page: async () => ({ data: [], total: 0 }),
        bulkUpdate: async () => ({ updated: [], skipped: [] }),
        bulkDelete: async () => ({ deleted: [], skipped: [] }),
      }),
    },
  ),
  trips: {
    share: async () => ({ share_enabled: false, share_token: null, share_url: '' }),
    revokeShare: async () => ({ share_enabled: false, share_token: null }),
  },
  tasks: {
    list: async () => [],
    create: async () => ({}),
    complete: async () => ({}),
  },
  integrations: {
    Core: {
      UploadFile: async () => ({ file_url: '' }),
      SendEmail: async () => ({}),
      SendSMS: async () => ({}),
      InvokeLLM: async () => ({}),
      GenerateImage: async () => ({ image_url: '' }),
      ExtractDataFromUploadedFile: async () => ({ data: {} }),
      GetExchangeRate: async () => ({ rate: 1 }),
      SupplierWebSearch: async () => ({ results: [] }),
      OutlookStatus: async () => ({ connected: false }),
      OutlookConnect: async () => {
        throw new Error('API client not loaded');
      },
      OutlookSend: async () => {
        throw new Error('API client not loaded');
      },
      OutlookDisconnect: async () => ({}),
    },
  },
  appLogs: {
    logUserInApp: async () => {},
  },
  reports: {
    revenueOverview: async () => ({
      totalRevenue: 0,
      totalOutstanding: 0,
      monthlyConfirmedRevenue: 0,
      monthlyConfirmedCount: 0,
      pendingProposals: 0,
      acceptedProposals: 0,
      proposalAcceptRate: 0,
      upcomingPaymentDues: [],
    }),
    commissions: async () => ({
      totalCommission: 0,
      totalProfit: 0,
      totalRevenue: 0,
      avgCommissionRate: 0,
      byAgent: [],
      trips: [],
    }),
  },
};

const DbContext = createContext(null);

/** Provides the shared `db` client (auth/entities/integrations/reports) to the app. */
export function DbProvider({ children }) {
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

/** Reads the `db` client from context, falling back to the module-level `db` if used outside a provider. */
export function useDb() {
  const ctx = useContext(DbContext);
  if (!ctx) return db;
  return ctx;
}

export { db };
