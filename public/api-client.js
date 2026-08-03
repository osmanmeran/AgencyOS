(function () {
  'use strict';

  var API_BASE = '/api';

  function setCurrentUser(user) {
    // Only store non-sensitive fields
    try {
      if (user) {
        localStorage.setItem(
          'marvelops_current_user',
          JSON.stringify({
            id: user.id,
            name: user.name,
            email: user.email,
            language: user.language,
          }),
        );
      } else {
        localStorage.removeItem('marvelops_current_user');
      }
    } catch (e) {}
  }

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('marvelops_current_user'));
    } catch (e) {
      return null;
    }
  }

  // Double-submit CSRF cookie set by setTokenCookie() on login; not
  // httpOnly, so it's readable here and echoed back as a header for the
  // backend's csrfMiddleware to compare against.
  function getCsrfToken() {
    var match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  // Session-establishing endpoints: a 401 here is a genuine auth failure (bad
  // credentials, invalid token), NOT an expired access token — so it must not
  // trigger the refresh-on-401 retry below (which would swallow the real error
  // like "Invalid email or password" behind a generic "Session expired").
  // Mirrors server/middleware/csrf.js EXEMPT_PATHS (+ /auth/refresh itself).
  var AUTH_ENTRY_PATHS = [
    '/auth/login',
    '/auth/microsoft',
    '/auth/accept-invite',
    '/auth/refresh',
    '/auth/forgot-password',
    '/auth/reset-password',
  ];

  // Standalone / pre-auth pages that run their own auth handshake (or are
  // magic-link pages). A failed background `me()` here must NOT hard-redirect
  // to the login page — doing so on the SSO callback interrupts the in-flight
  // token exchange and bounces the user back to login (redirect loop).
  // Mirrors NON_REDIRECT_ROUTES in src/App.jsx.
  var NO_REDIRECT_PATHS = [
    '/mock-login',
    '/signup',
    '/auth/microsoft/callback',
    '/accept-invite',
    '/forgot-password',
    '/reset-password',
    '/auth/outlook-callback',
    '/client-itinerary',
    '/request-quote',
  ];
  // Prefix variant for routes with a dynamic path segment (the share token).
  var NO_REDIRECT_PREFIXES = ['/share/itinerary/'];
  function isNoRedirectPath(pathname) {
    if (NO_REDIRECT_PATHS.indexOf(pathname) !== -1) return true;
    for (var i = 0; i < NO_REDIRECT_PREFIXES.length; i++) {
      if (pathname.indexOf(NO_REDIRECT_PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  // Single in-flight refresh so concurrent 401s share one rotation instead of
  // each trying (and the second failing because the first already revoked it).
  var refreshPromise = null;
  function refreshAuth() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = fetch(API_BASE + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() || '' },
      credentials: 'include',
    })
      .then(function (res) {
        if (!res.ok) throw new Error('refresh failed');
        return res.json();
      })
      .then(function (data) {
        if (data && data.user) setCurrentUser(data.user);
        return data;
      })
      .finally(function () {
        refreshPromise = null;
      });
    return refreshPromise;
  }

  async function api(path, options) {
    options = options || {};
    var headers = { 'Content-Type': 'application/json' };
    var csrfToken = getCsrfToken();
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    if (options.headers) {
      for (var k in options.headers) headers[k] = options.headers[k];
    }

    var res = await fetch(API_BASE + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body || undefined,
      credentials: 'include', // Send cookies for httpOnly token
    });

    var data;
    try {
      data = await res.json();
    } catch (e) {
      data = { message: res.statusText };
    }

    if (!res.ok) {
      // Access tokens are short-lived (~15m). On expiry, transparently rotate
      // via the refresh-token cookie and retry the original request once.
      if (res.status === 401 && !options._isRefresh && AUTH_ENTRY_PATHS.indexOf(path) === -1) {
        try {
          await refreshAuth();
          return api(path, Object.assign({}, options, { _isRefresh: true }));
        } catch (e) {
          setCurrentUser(null);
          if (typeof window !== 'undefined' && !isNoRedirectPath(window.location.pathname)) {
            // Don't redirect on the login page (would loop returnUrl forever)
            // or on standalone/pre-auth pages like the SSO callback, whose own
            // handshake would be interrupted by a hard navigation.
            window.location.href = '/mock-login?returnUrl=' + encodeURIComponent(window.location.href);
          }
          var refreshErr = new Error('Session expired. Please sign in again.');
          refreshErr.status = 401;
          refreshErr.code = 'SESSION_EXPIRED';
          throw refreshErr;
        }
      }

      // Server errors are shaped { error: { code, message, details? } } (see
      // server/middleware/errors.js sendError/errorHandler and validate.js).
      // Older code here only checked data.message, which is never set on
      // that shape, so every failure surfaced as a useless "API Error (400)".
      var apiError = data && data.error;
      var message = (apiError && apiError.message) || (data && data.message) || 'API Error (' + res.status + ')';
      if (apiError && Array.isArray(apiError.details) && apiError.details.length) {
        message +=
          ': ' +
          apiError.details
            .map(function (d) {
              return (d.path ? d.path + ' ' : '') + d.message;
            })
            .join(', ');
      }
      var err = new Error(message);
      err.status = res.status;
      err.code = apiError && apiError.code;
      err.data = data;
      throw err;
    }

    return data;
  }

  function makeEntityApi(name) {
    return {
      list: function (sort) {
        var params = sort ? '?sort=' + encodeURIComponent(sort) : '';
        return api('/entities/' + name + params);
      },
      filter: function (query, sort) {
        var params = '?filter=' + encodeURIComponent(JSON.stringify(query || {}));
        if (sort) params += '&sort=' + encodeURIComponent(sort);
        return api('/entities/' + name + params);
      },
      get: function (id) {
        return api('/entities/' + name + '/' + id);
      },
      create: function (data) {
        return api('/entities/' + name, { method: 'POST', body: JSON.stringify(data || {}) });
      },
      update: function (id, data) {
        return api('/entities/' + name + '/' + id, { method: 'PUT', body: JSON.stringify(data || {}) });
      },
      delete: function (id) {
        return api('/entities/' + name + '/' + id, { method: 'DELETE' });
      },
      // Paginated variant — returns { data, total } instead of a plain array.
      // Opt-in: existing list()/filter() callers are unaffected.
      page: function (opts) {
        opts = opts || {};
        var params = [];
        if (opts.filter) params.push('filter=' + encodeURIComponent(JSON.stringify(opts.filter)));
        if (opts.sort) params.push('sort=' + encodeURIComponent(opts.sort));
        if (opts.search) params.push('search=' + encodeURIComponent(opts.search));
        params.push('limit=' + encodeURIComponent(opts.limit != null ? opts.limit : 50));
        params.push('offset=' + encodeURIComponent(opts.offset || 0));
        return api('/entities/' + name + '?' + params.join('&'));
      },
      bulkCreate: function (records) {
        return api('/entities/' + name + '/bulk-create', {
          method: 'POST',
          body: JSON.stringify({ records: records || [] }),
        });
      },
      bulkUpdate: function (ids, data) {
        return api('/entities/' + name + '/bulk-update', {
          method: 'POST',
          body: JSON.stringify({ ids: ids || [], data: data || {} }),
        });
      },
      bulkDelete: function (ids) {
        return api('/entities/' + name + '/bulk-delete', { method: 'POST', body: JSON.stringify({ ids: ids || [] }) });
      },
    };
  }

  // No hardcoded entity allowlist here — the server (server/db.js ENTITIES +
  // assertKnownType) is the single source of truth. This Proxy lazily builds
  // an entity API for any accessed name; unknown types get a 400 from the
  // server. Non-entity properties assigned later (e.g. `.Query`) are stored on
  // the target and returned as-is.
  var entityApiCache = {};
  var entityApis = new Proxy(entityApiCache, {
    get: function (target, name) {
      if (typeof name !== 'string' || name === 'then') return target[name];
      if (!(name in target)) target[name] = makeEntityApi(name);
      return target[name];
    },
  });

  var db = {
    auth: {
      isAuthenticated: function () {
        return api('/auth/me')
          .then(function () {
            return true;
          })
          .catch(function () {
            return false;
          });
      },
      me: function () {
        return api('/auth/me').then(function (data) {
          return data.user || data;
        });
      },
      loginViaEmailPassword: function (email, password) {
        return api('/auth/login', { method: 'POST', body: JSON.stringify({ email: email, password: password }) }).then(
          function (result) {
            setCurrentUser(result.user);
            return result.user;
          },
        );
      },
      microsoftLogin: function (idToken) {
        return api('/auth/microsoft', { method: 'POST', body: JSON.stringify({ idToken: idToken }) }).then(
          function (result) {
            setCurrentUser(result.user);
            return result.user;
          },
        );
      },
      updateMe: function (data) {
        return api('/auth/me', { method: 'PUT', body: JSON.stringify(data || {}) }).then(function (res) {
          var user = res.user || res;
          setCurrentUser(user);
          return user;
        });
      },
      logout: function (redirectUrl) {
        // Call server to clear httpOnly cookie (CSRF-protected, so echo the token)
        fetch(API_BASE + '/auth/logout', {
          method: 'POST',
          headers: { 'X-CSRF-Token': getCsrfToken() || '' },
          credentials: 'include',
        }).catch(function () {});
        setCurrentUser(null);
        if (redirectUrl) {
          // Prevent nested returnUrl loops
          var target = redirectUrl;
          if (target.indexOf('/mock-login') !== -1) {
            var parsed = new URL(target, window.location.origin);
            var existingReturn = parsed.searchParams.get('returnUrl');
            if (existingReturn) target = existingReturn;
            else target = '/';
          }
          window.location.href = '/mock-login?returnUrl=' + encodeURIComponent(target);
        } else {
          window.location.href = '/mock-login';
        }
      },
      redirectToLogin: function (returnUrl) {
        // Prevent nested returnUrl loops
        var target = returnUrl || window.location.href;
        if (target.indexOf('/mock-login') !== -1) {
          var parsed = new URL(target, window.location.origin);
          var existingReturn = parsed.searchParams.get('returnUrl');
          if (existingReturn) target = existingReturn;
          else target = '/';
        }
        window.location.href = '/mock-login?returnUrl=' + encodeURIComponent(target);
      },
      // User management (admin)
      users: function () {
        return api('/auth/users');
      },
      createUser: function (data) {
        return api('/auth/users', { method: 'POST', body: JSON.stringify(data || {}) });
      },
      updateUser: function (id, data) {
        return api('/auth/users/' + id, { method: 'PUT', body: JSON.stringify(data || {}) });
      },
      deleteUser: function (id) {
        return api('/auth/users/' + id, { method: 'DELETE' });
      },
      invite: function (data) {
        return api('/auth/invite', { method: 'POST', body: JSON.stringify(data || {}) });
      },
      acceptInvite: function (data) {
        return api('/auth/accept-invite', { method: 'POST', body: JSON.stringify(data || {}) }).then(function (result) {
          setCurrentUser(result.user);
          return result.user;
        });
      },
      forgotPassword: function (email) {
        return api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: email }) });
      },
      resetPassword: function (data) {
        return api('/auth/reset-password', { method: 'POST', body: JSON.stringify(data || {}) });
      },
      // Client Portal access provisioning (requires grant_client_portal)
      getClientPortal: function (clientId) {
        return api('/auth/client-portal/' + clientId);
      },
      grantClientPortal: function (clientId) {
        return api('/auth/client-portal/grant', { method: 'POST', body: JSON.stringify({ clientId: clientId }) });
      },
      revokeClientPortal: function (clientId) {
        return api('/auth/client-portal/revoke', { method: 'POST', body: JSON.stringify({ clientId: clientId }) });
      },
      // Supplier Portal access provisioning (requires grant_supplier_portal)
      getSupplierPortal: function (supplierId) {
        return api('/auth/supplier-portal/' + supplierId);
      },
      grantSupplierPortal: function (supplierId) {
        return api('/auth/supplier-portal/grant', {
          method: 'POST',
          body: JSON.stringify({ supplierId: supplierId }),
        });
      },
      revokeSupplierPortal: function (supplierId) {
        return api('/auth/supplier-portal/revoke', {
          method: 'POST',
          body: JSON.stringify({ supplierId: supplierId }),
        });
      },
    },
    entities: entityApis,
    trips: {
      share: function (id, opts) {
        return api('/trips/' + id + '/share', { method: 'POST', body: JSON.stringify(opts || {}) });
      },
      revokeShare: function (id) {
        return api('/trips/' + id + '/share', { method: 'DELETE' });
      },
    },
    // Operational Task engine (server/services/tasks.js) — distinct from the
    // generic entities.Task CRUD: adds FK/SLA query filters and the audited
    // /complete action.
    tasks: {
      list: function (params) {
        var qs = [];
        if (params) {
          Object.keys(params).forEach(function (key) {
            var value = params[key];
            if (value !== undefined && value !== null && value !== '') {
              qs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
            }
          });
        }
        return api('/tasks' + (qs.length ? '?' + qs.join('&') : ''));
      },
      create: function (data) {
        return api('/tasks', { method: 'POST', body: JSON.stringify(data || {}) });
      },
      complete: function (id, note) {
        return api('/tasks/' + id + '/complete', { method: 'PUT', body: JSON.stringify({ note: note }) });
      },
    },
    integrations: {
      Core: {
        UploadFile: function (data) {
          if (data?.file instanceof File || data?.file instanceof Blob) {
            var formData = new FormData();
            formData.append('file', data.file);
            return fetch(API_BASE + '/integrations/upload', {
              method: 'POST',
              body: formData,
              credentials: 'include',
            }).then(function (r) {
              return r.json();
            });
          }
          return api('/integrations/upload', { method: 'POST', body: JSON.stringify(data || {}) });
        },
        SendEmail: function (opts) {
          // Try Outlook first if user has it connected
          return api('/integrations/outlook/status')
            .catch(function (err) {
              err._isStatusCheck = true;
              throw err;
            })
            .then(function (status) {
              if (status.connected) {
                return api('/integrations/outlook/send', { method: 'POST', body: JSON.stringify(opts || {}) });
              }
              return api('/integrations/email', { method: 'POST', body: JSON.stringify(opts || {}) });
            })
            .catch(function (statusErr) {
              // Only fall back if the STATUS CHECK itself failed (not a send failure)
              if (statusErr && statusErr._isStatusCheck) {
                return api('/integrations/email', { method: 'POST', body: JSON.stringify(opts || {}) });
              }
              throw statusErr;
            });
        },
        SendSMS: function (opts) {
          return api('/integrations/sms', { method: 'POST', body: JSON.stringify(opts || {}) });
        },
        GetExchangeRate: function (from, to) {
          return api('/integrations/exchange-rate?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to));
        },
        SupplierWebSearch: function (opts) {
          return api('/integrations/supplier-web-search', { method: 'POST', body: JSON.stringify(opts || {}) });
        },
        OutlookStatus: function () {
          return api('/integrations/outlook/status');
        },
        OutlookConnect: function (tokenData) {
          return api('/integrations/outlook/connect', {
            method: 'POST',
            body: JSON.stringify({ token_data: tokenData }),
          });
        },
        OutlookSend: function (opts) {
          return api('/integrations/outlook/send', { method: 'POST', body: JSON.stringify(opts || {}) });
        },
        OutlookDisconnect: function () {
          return api('/integrations/outlook/disconnect', { method: 'POST' });
        },
      },
    },
    payments: {
      createCheckoutSession: function (invoiceId) {
        return api('/payments/checkout-session', { method: 'POST', body: JSON.stringify({ invoiceId: invoiceId }) });
      },
      getSettings: function () {
        return api('/payments/settings');
      },
      saveSettings: function (opts) {
        return api('/payments/settings', { method: 'POST', body: JSON.stringify(opts || {}) });
      },
    },
    appLogs: {
      logUserInApp: function (pageName) {
        return api('/app-logs', { method: 'POST', body: JSON.stringify({ pageName: pageName }) });
      },
    },
    reports: {
      revenueOverview: function () {
        return api('/reports/revenue-overview');
      },
      commissions: function () {
        return api('/reports/commissions');
      },
    },
    Query: {
      query: function (sql) {
        return Promise.reject(new Error('Direct SQL queries are not supported'));
      },
    },
  };

  db.User = db.auth;
  db.Core = db.integrations.Core;
  db.entities.Query = db.Query;

  globalThis.__B44_DB__ = db;
})();
