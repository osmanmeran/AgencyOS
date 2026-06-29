(function () {
  if (globalThis.__B44_DB__) return;

  var ENTITIES = ['AppSettings','BookingRequest','BookingTemplate','Client','ClientPayment','ClientTask','EmailLog','Invoice','ItineraryEvent','Message','PackingItem','Proposal','ProposalTemplate','ReferenceCounter','ServiceCategory','ServiceTemplate','Suggestion','Supplier','SupplierBooking','SupplierCategory','SupplierInvoice','SupplierPricing','SupplierReview','SupplierService','SupplierSubcategory','Trip'];

  function makeApi() {
    var api = {};
    ENTITIES.forEach(function (name) {
      api[name] = {
        list: function () { return Promise.resolve([]); },
        filter: function () { return Promise.resolve([]); },
        get: function () { return Promise.resolve(null); },
        create: function (d) { return Promise.resolve(d || {}); },
        update: function () { return Promise.resolve({}); },
        delete: function () { return Promise.resolve({}); },
      };
    });
    return api;
  }

  var mockDB = {
    auth: {
      isAuthenticated: function () { return Promise.resolve(false); },
      me: function () { return Promise.resolve(null); },
      login: function (email) {
        var user = { id: 'mock_' + Date.now(), name: email.split('@')[0], email: email, user_tier: 'admin', role: 'admin', custom_permissions: [] };
        try { localStorage.setItem('marvelops_mock_current_user', JSON.stringify(user)); } catch (e) {}
        return Promise.resolve(user);
      },
      updateMe: function (d) { return Promise.resolve(d || {}); },
      logout: function () {},
      redirectToLogin: function (url) {
        window.location.href = '/mock-login?returnUrl=' + encodeURIComponent(url || window.location.href);
      },
      microsoftLogin: function (idToken) {
        return Promise.resolve({ id: 'mock_ms_' + Date.now(), name: 'Microsoft User', email: 'msuser@example.com', user_tier: 'agent', role: 'agent', custom_permissions: [] });
      },
    },
    entities: makeApi(),
    integrations: {
      Core: {
        UploadFile: function () { return Promise.resolve({ file_url: '' }); },
        SendEmail: function () { return Promise.resolve({}); },
        SendSMS: function () { return Promise.resolve({}); },
        InvokeLLM: function (p) { return Promise.resolve({ result: 'mock response' }); },
        GenerateImage: function () { return Promise.resolve({ image_url: '' }); },
        ExtractDataFromUploadedFile: function () { return Promise.resolve({ data: {} }); },
      },
    },
    appLogs: {
      logUserInApp: function () { return Promise.resolve(); },
    },
    Query: { query: function () { return Promise.resolve([]); } },
  };
  mockDB.User = mockDB.auth;
  mockDB.Core = mockDB.integrations.Core;
  mockDB.entities.Query = mockDB.Query;

  globalThis.__B44_DB__ = mockDB;
})();
