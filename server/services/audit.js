import { getDb, uid } from '../db.js';

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
};

export function logAudit({ userId, userName, action, entityType, entityId, changes, ip } = {}) {
  const db = getDb();
  const id = uid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, changes, ip, created_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId || null, userName || null, action, entityType || null, entityId || null,
    changes ? JSON.stringify(changes) : null, ip || null, now);

  return id;
}

export function getAuditLogs({ entityType, entityId, userId, action, limit = 100, offset = 0 } = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (entityType) { conditions.push('entity_type = ?'); params.push(entityType); }
  if (entityId) { conditions.push('entity_id = ?'); params.push(entityId); }
  if (userId) { conditions.push('user_id = ?'); params.push(userId); }
  if (action) { conditions.push('action = ?'); params.push(action); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const rows = db.prepare(`
    SELECT * FROM audit_logs ${where} ORDER BY created_date DESC LIMIT ? OFFSET ?
  `).all(...params);

  return rows.map(r => ({
    ...r,
    changes: r.changes ? JSON.parse(r.changes) : null,
  }));
}

// Express middleware — logs every state-changing request
export function auditMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const method = req.method;
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isAuthRoute = req.path.startsWith('/api/auth');

    if (isMutation && req.user) {
      const entityType = req.baseUrl?.split('/').pop() || req.path.split('/')[2];
      const entityId = req.params?.id || req.body?.id || body?.id;
      const action = method === 'POST' ? 'create' : method === 'DELETE' ? 'delete' : 'update';

      const changes = {};
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        Object.entries(req.body || {}).forEach(([k, v]) => {
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
