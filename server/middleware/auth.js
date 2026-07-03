import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import logger from '../lib/logger.js';
import { sendError } from './errors.js';

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  const generated = crypto.randomBytes(32).toString('hex');
  logger.warn('JWT_SECRET not set — using ephemeral secret. Set it in .env for persistence.');
  process.env.JWT_SECRET = generated;
  JWT_SECRET = generated;
}

export function getJwtSecret() {
  return process.env.JWT_SECRET;
}

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id, email: user.email, user_tier: user.user_tier, role: user.role,
      custom_permissions: user.custom_permissions || [],
      client_id: user.client_id || null, linked_supplier_id: user.linked_supplier_id || null,
    },
    getJwtSecret(),
    { expiresIn: '24h' }
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

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;
    next();
  } catch (err) {
    return sendError(res, 401, 'INVALID_TOKEN', 'Invalid or expired token');
  }
}
