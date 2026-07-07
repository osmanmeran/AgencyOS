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

  async function api(path, options) {
    options = options || {};
    var headers = { 'Content-Type': 'application/json' };
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

  var ENTITIES = [
    'AppSettings',
    'BookingRequest',
    'BookingTemplate',
    'Client',
    'ClientPayment',
    'ClientTask',
    'Company',
    'EmailLog',
    'Invoice',
    'ItineraryEvent',
    'Message',
    'PackingItem',
    'Proposal',
    'ProposalTemplate',
    'QuoteRequest',
    'ReferenceCounter',
    'ReportSchedule',
    'ServiceCategory',
    'ServiceTemplate',
    'Suggestion',
    'Supplier',
    'SupplierBooking',
    'SupplierCategory',
    'SupplierInvoice',
    'SupplierPricing',
    'SupplierReview',
    'SupplierService',
    'SupplierStopSale',
    'SupplierSubcategory',
    'TourContract',
    'Trip',
  ];

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

  var entityApis = {};
  for (var i = 0; i < ENTITIES.length; i++) {
    entityApis[ENTITIES[i]] = makeEntityApi(ENTITIES[i]);
  }

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
        // Call server to clear httpOnly cookie
        fetch(API_BASE + '/auth/logout', { method: 'POST', credentials: 'include' }).catch(function () {});
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
    },
    entities: entityApis,
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
