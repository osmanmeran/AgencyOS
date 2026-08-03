import { getDb, uid } from '../db.js';

// Never copy these request-body fields into the audit trail (they'd otherwise
// be persisted in plaintext and shipped to log aggregators).
const SENSITIVE_AUDIT_FIELDS = new Set([
  'password',
  'current_password',
  'new_password',
  'token',
  'access_token',
  'refresh_token',
  'invite_token',
  'secret',
]);

export const AUDIT_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  EMAIL_SENT: 'email_sent',
  PDF_GENERATED: 'pdf_generated',
  UPLOAD: 'upload',
  PORTAL_GRANT: 'portal_grant',
  PORTAL_REVOKE: 'portal_revoke',
  TENANT_CREATE: 'tenant_create',
  TENANT_UPDATE: 'tenant_update',
  PLATFORM_LIST_WORKSPACES: 'platform_list_workspaces',
  PLATFORM_SET_STATUS: 'platform_set_workspace_status',
  PLATFORM_EXTEND_TRIAL: 'platform_extend_trial',
  PLATFORM_DELETE_WORKSPACE: 'platform_delete_workspace',
};

/**
 * Insert one row into `audit_logs`.
 * @param {object} params
 * @param {string} [params.userId]
 * @param {string} [params.userName]
 * @param {string} params.action - One of `AUDIT_ACTIONS`.
 * @param {string} [params.entityType]
 * @param {string} [params.entityId]
 * @param {object} [params.changes] - Shallow field diff, JSON-serialized.
 * @param {string} [params.ip]
 * @returns {string} The generated audit log id.
 */
export function logAudit({ userId, userName, action, entityType, entityId, changes, ip } = {}) {
  const db = getDb();
  const id = uid();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, changes, ip, created_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    userId || null,
    userName || null,
    action,
    entityType || null,
    entityId || null,
    changes ? JSON.stringify(changes) : null,
    ip || null,
    now,
  );

  return id;
}

/**
 * Query `audit_logs`, newest first, with optional exact-match filters.
 * @param {object} [params]
 * @param {string} [params.entityType]
 * @param {string} [params.entityId]
 * @param {string} [params.userId]
 * @param {string} [params.action]
 * @param {number} [params.limit=100]
 * @param {number} [params.offset=0]
 * @returns {object[]} Rows with `changes` parsed back into an object.
 */
export function getAuditLogs({ entityType, entityId, userId, action, limit = 100, offset = 0 } = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (entityType) {
    conditions.push('entity_type = ?');
    params.push(entityType);
  }
  if (entityId) {
    conditions.push('entity_id = ?');
    params.push(entityId);
  }
  if (userId) {
    conditions.push('user_id = ?');
    params.push(userId);
  }
  if (action) {
    conditions.push('action = ?');
    params.push(action);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const rows = db
    .prepare(
      `
    SELECT * FROM audit_logs ${where} ORDER BY created_date DESC LIMIT ? OFFSET ?
  `,
    )
    .all(...params);

  return rows.map((r) => ({
    ...r,
    changes: r.changes ? JSON.parse(r.changes) : null,
  }));
}

/** Express middleware that logs every state-changing (POST/PUT/PATCH/DELETE) request via {@link logAudit}. */
export function auditMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const method = req.method;
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (isMutation && req.user) {
      const entityType = req.params?.type || req.baseUrl?.split('/').pop() || req.path.split('/')[2];
      const entityId = req.params?.id || req.body?.id || body?.id;
      const action = method === 'POST' ? 'create' : method === 'DELETE' ? 'delete' : 'update';

      const changes = {};
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        Object.entries(req.body || {}).forEach(([k, v]) => {
          if (SENSITIVE_AUDIT_FIELDS.has(k.toLowerCase())) return;
          if (typeof v !== 'object' || v === null) changes[k] = v;
        });
      }

      logAudit({
        userId: req.user.id,
        userName: req.user.email,
        action,
        entityType,
        entityId: entityId || undefined,
        changes: Object.keys(changes).length > 0 ? changes : undefined,
        ip: req.ip,
      });
    }

    return originalJson(body);
  };
  next();
}
