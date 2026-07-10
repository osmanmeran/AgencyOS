import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import logger from '../lib/logger.js';
import { sendError } from './errors.js';
import { getDb } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error('JWT_SECRET is not set. Set it in .env for persistence.');
  // Use an ephemeral secret as fallback so the app can still start,
  // but all existing tokens become invalid on restart.
  const generated = crypto.randomBytes(32).toString('hex');
  process.env.JWT_SECRET = generated;
}

export function getJwtSecret() {
  return process.env.JWT_SECRET;
}

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      user_tier: user.user_tier,
      role: user.role,
      custom_permissions: user.custom_permissions || [],
      client_id: user.client_id || null,
      linked_supplier_id: user.linked_supplier_id || null,
    },
    getJwtSecret(),
    { expiresIn: '24h' },
  );
}

export function authMiddleware(req, res, next) {
  let token = null;

  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // Fall back to httpOnly cookie
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return sendError(res, 401, 'AUTH_REQUIRED', 'Authentication required');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, getJwtSecret());
  } catch (err) {
    return sendError(res, 401, 'INVALID_TOKEN', 'Invalid or expired token');
  }

  // The token only proves identity. Tier, permissions, and scoping are
  // re-read from the DB on every request (a single PK lookup) so permission
  // changes and deactivations apply immediately instead of after the token's
  // 24h lifetime.
  const row = getDb()
    .prepare(
      'SELECT id, email, name, user_tier, role, custom_permissions, client_id, linked_supplier_id, is_active FROM users WHERE id = ?',
    )
    .get(decoded.id);
  if (!row || !row.is_active) {
    return sendError(res, 401, 'INVALID_TOKEN', 'Invalid or expired token');
  }

  let customPermissions = [];
  try {
    const parsed = JSON.parse(row.custom_permissions || '[]');
    if (Array.isArray(parsed)) customPermissions = parsed;
  } catch {}

  req.user = {
    id: row.id,
    email: row.email,
    name: row.name,
    user_tier: row.user_tier,
    role: row.role,
    custom_permissions: customPermissions,
    client_id: row.client_id || null,
    linked_supplier_id: row.linked_supplier_id || null,
  };
  next();
}
