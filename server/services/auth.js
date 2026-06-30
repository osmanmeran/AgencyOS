import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { getDb, uid } from '../db.js';
import { getJwtSecret } from '../middleware/auth.js';
import { ForbiddenError, ConflictError, UnauthorizedError } from '../middleware/errors.js';
import logger from '../lib/logger.js';

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || process.env.VITE_MICROSOFT_CLIENT_ID || '';
const MICROSOFT_TENANT = process.env.MICROSOFT_TENANT || process.env.VITE_MICROSOFT_TENANT || 'common';
const MICROSOFT_JWKS_URI = `https://login.microsoftonline.com/${MICROSOFT_TENANT}/discovery/v2.0/keys`;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';

// Log configuration on startup for debugging
if (!MICROSOFT_CLIENT_ID) {
  logger.warn('Microsoft OAuth not configured: MICROSOFT_CLIENT_ID or VITE_MICROSOFT_CLIENT_ID is not set');
} else {
  logger.info({ clientId: MICROSOFT_CLIENT_ID.substring(0, 8) + '...', tenant: MICROSOFT_TENANT }, 'Microsoft OAuth configured');
}

if (!GOOGLE_CLIENT_ID) {
  logger.warn('Google OAuth not configured: GOOGLE_CLIENT_ID or VITE_GOOGLE_CLIENT_ID is not set');
} else {
  logger.info({ clientId: GOOGLE_CLIENT_ID.substring(0, 8) + '...' }, 'Google OAuth configured');
}

const msJwksClient = jwksClient({
  jwksUri: MICROSOFT_JWKS_URI,
  cache: true,
  cacheMaxAge: 86400000,
});

const googleJwksClient = jwksClient({
  jwksUri: GOOGLE_JWKS_URI,
  cache: true,
  cacheMaxAge: 86400000,
});

export const VALID_TIERS = ['admin', 'manager', 'accounting', 'agent'];

export function safeUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone || '', user_tier: u.user_tier, role: u.role,
    language: u.language, default_currency: u.default_currency || 'USD',
    custom_permissions: JSON.parse(u.custom_permissions || '[]'),
    departments: JSON.parse(u.departments || '[]'),
    client_id: u.client_id, linked_supplier_id: u.linked_supplier_id,
    is_active: !!u.is_active, created_date: u.created_date,
  };
}

export function setTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function authenticateLocal(email, password) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !user.is_active) throw new UnauthorizedError('Invalid email or password');

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) throw new UnauthorizedError('Invalid email or password');

  return safeUser(user);
}

export async function authenticateMicrosoft(idToken) {
  if (!MICROSOFT_CLIENT_ID) {
    logger.error('Microsoft OAuth attempted but MICROSOFT_CLIENT_ID is not configured');
    throw new UnauthorizedError('Microsoft login not configured', 'MICROSOFT_NOT_CONFIGURED');
  }

  const payload = await verifyMicrosoftToken(idToken);
  if (!payload) {
    logger.error('Microsoft token verification failed - payload is null');
    throw new UnauthorizedError('Invalid or expired Microsoft token');
  }

  const microsoftId = payload.oid || payload.sub;
  const email = payload.preferred_username || payload.email || payload.unique_name || `${microsoftId}@microsoft.local`;
  const name = payload.name || email.split('@')[0];

  logger.info({ email, microsoftId: microsoftId.substring(0, 8) + '...' }, 'Microsoft token verified, authenticating user');

  const db = getDb();
  const txn = db.transaction(() => {
    let user = db.prepare('SELECT * FROM users WHERE microsoft_id = ?').get(microsoftId);
    if (!user) {
      const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (existingUser) {
        logger.info({ email, userId: existingUser.id }, 'Linking Microsoft ID to existing user');
        db.prepare('UPDATE users SET microsoft_id = ?, updated_date = ? WHERE id = ?')
          .run(microsoftId, new Date().toISOString(), existingUser.id);
        user = existingUser;
      } else {
        logger.info({ email }, 'Creating new user from Microsoft SSO');
        const now = new Date().toISOString();
        const id = uid();
        const hashed = bcrypt.hashSync(microsoftId, 10);
        db.prepare('INSERT INTO users (id, email, password, name, user_tier, role, language, custom_permissions, microsoft_id, departments, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)')
          .run(id, email, hashed, name, 'agent', 'agent', 'en', '[]', microsoftId, '[]', now, now);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      }
    }
    return user;
  });

  const user = txn();
  if (!user.is_active) {
    logger.warn({ email }, 'Microsoft login attempted but account is inactive');
    throw new ForbiddenError('Account pending approval. Contact an administrator.', 'ACCOUNT_PENDING');
  }

  logger.info({ email, userId: user.id }, 'Microsoft SSO authentication successful');
  return safeUser(user);
}

export async function authenticateGoogle(idToken) {
  if (!GOOGLE_CLIENT_ID) {
    logger.error('Google OAuth attempted but GOOGLE_CLIENT_ID is not configured');
    throw new UnauthorizedError('Google login not configured', 'GOOGLE_NOT_CONFIGURED');
  }

  const payload = await verifyGoogleToken(idToken);
  if (!payload) {
    logger.error('Google token verification failed - payload is null');
    throw new UnauthorizedError('Invalid or expired Google token');
  }

  const googleId = payload.sub;
  const email = payload.email;
  const name = payload.name || email.split('@')[0];

  logger.info({ email, googleId: googleId.substring(0, 8) + '...' }, 'Google token verified, authenticating user');

  const db = getDb();
  const txn = db.transaction(() => {
    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
    if (!user) {
      const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (existingUser) {
        logger.info({ email, userId: existingUser.id }, 'Linking Google ID to existing user');
        db.prepare('UPDATE users SET google_id = ?, updated_date = ? WHERE id = ?')
          .run(googleId, new Date().toISOString(), existingUser.id);
        user = existingUser;
      } else {
        logger.info({ email }, 'Creating new user from Google SSO');
        const now = new Date().toISOString();
        const id = uid();
        const hashed = bcrypt.hashSync(googleId, 10);
        db.prepare('INSERT INTO users (id, email, password, name, user_tier, role, language, custom_permissions, google_id, departments, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)')
          .run(id, email, hashed, name, 'agent', 'agent', 'en', '[]', googleId, '[]', now, now);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      }
    }
    return user;
  });

  const user = txn();
  if (!user.is_active) {
    logger.warn({ email }, 'Google login attempted but account is inactive');
    throw new ForbiddenError('Account pending approval. Contact an administrator.', 'ACCOUNT_PENDING');
  }

  logger.info({ email, userId: user.id }, 'Google SSO authentication successful');
  return safeUser(user);
}

async function verifyMicrosoftToken(idToken) {
  try {
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || !decoded.header || !decoded.header.kid) {
      logger.error({ header: decoded?.header }, 'Microsoft token missing kid in header');
      return null;
    }

    logger.debug({ kid: decoded.header.kid, alg: decoded.header.alg }, 'Microsoft token decoded');

    let publicKey;
    try {
      const key = await msJwksClient.getSigningKey(decoded.header.kid);
      publicKey = key.getPublicKey();
      logger.debug('Microsoft signing key obtained successfully');
    } catch (err) {
      logger.error({ err: err.message, kid: decoded.header.kid, jwksUri: MICROSOFT_JWKS_URI }, 'Failed to get Microsoft signing key');
      return null;
    }

    try {
      const payload = jwt.verify(idToken, publicKey, {
        algorithms: ['RS256'],
        audience: MICROSOFT_CLIENT_ID,
      });

      const iss = payload.iss;
      const validIssuer =
        /^https:\/\/login\.microsoftonline\.com\/[^/]+\/v2\.0$/.test(iss) ||
        /^https:\/\/sts\.windows\.net\/[^/]+\/$/.test(iss);
      
      if (!validIssuer) {
        logger.error({ iss, MICROSOFT_CLIENT_ID, expectedIssuer: `https://login.microsoftonline.com/*/v2.0` }, 'Microsoft token rejected: invalid issuer');
        return null;
      }

      logger.debug({ iss, aud: payload.aud, oid: payload.oid }, 'Microsoft token verified successfully');
      return payload;
    } catch (err) {
      logger.error({ err: err.message, errName: err.name, MICROSOFT_CLIENT_ID, audience: MICROSOFT_CLIENT_ID }, 'Microsoft token verification failed');
      return null;
    }
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'Unexpected error during Microsoft token verification');
    return null;
  }
}

async function verifyGoogleToken(idToken) {
  try {
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || !decoded.header || !decoded.header.kid) {
      logger.error({ header: decoded?.header }, 'Google token missing kid in header');
      return null;
    }

    logger.debug({ kid: decoded.header.kid, alg: decoded.header.alg }, 'Google token decoded');

    let publicKey;
    try {
      const key = await googleJwksClient.getSigningKey(decoded.header.kid);
      publicKey = key.getPublicKey();
      logger.debug('Google signing key obtained successfully');
    } catch (err) {
      logger.error({ err: err.message, kid: decoded.header.kid, jwksUri: GOOGLE_JWKS_URI }, 'Failed to get Google signing key');
      return null;
    }

    try {
      const payload = jwt.verify(idToken, publicKey, {
        algorithms: ['RS256'],
        audience: GOOGLE_CLIENT_ID,
      });

      const iss = payload.iss;
      const validIssuer = /^https:\/\/accounts\.google\.com$/.test(iss) || /^https:\/\/accounts\.google\.com\/$/.test(iss);
      
      if (!validIssuer) {
        logger.error({ iss, GOOGLE_CLIENT_ID, expectedIssuer: 'https://accounts.google.com' }, 'Google token rejected: invalid issuer');
        return null;
      }

      logger.debug({ iss, aud: payload.aud, sub: payload.sub }, 'Google token verified successfully');
      return payload;
    } catch (err) {
      logger.error({ err: err.message, errName: err.name, GOOGLE_CLIENT_ID, audience: GOOGLE_CLIENT_ID }, 'Google token verification failed');
      return null;
    }
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'Unexpected error during Google token verification');
    return null;
  }
}

export function getUserById(id) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return user || null;
}

export function getUserPassword(id) {
  const db = getDb();
  return db.prepare('SELECT password FROM users WHERE id = ?').get(id);
}

export function updateUser(id, fields) {
  const db = getDb();
  const now = new Date().toISOString();
  const updates = [];
  const values = [];

  const fieldMap = {
    name: 'name', email: 'email', phone: 'phone', user_tier: 'user_tier', language: 'language',
    is_active: 'is_active', default_currency: 'default_currency',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (fields[key] !== undefined) {
      if (key === 'is_active') {
        updates.push(`${col} = ?`);
        values.push(fields[key] ? 1 : 0);
      } else {
        updates.push(`${col} = ?`);
        values.push(fields[key]);
      }
    }
  }

  if (fields.user_tier !== undefined) {
    updates.push('role = ?');
    values.push(fields.user_tier);
  }

  if (fields.custom_permissions !== undefined) {
    updates.push('custom_permissions = ?');
    values.push(JSON.stringify(fields.custom_permissions));
  }

  if (fields.departments !== undefined) {
    updates.push('departments = ?');
    values.push(JSON.stringify(fields.departments));
  }

  if (fields.password) {
    updates.push('password = ?');
    values.push(bcrypt.hashSync(fields.password, 10));
  }

  if (updates.length === 0) return null;

  updates.push('updated_date = ?');
  values.push(now);
  values.push(id);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function deleteUser(id) {
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function getAllUsers() {
  const db = getDb();
  return db.prepare('SELECT * FROM users ORDER BY created_date ASC').all();
}

export function inviteUser({ email, name, user_tier, custom_permissions, departments, invited_by }) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) throw new ConflictError('Email already registered');

  const tier = VALID_TIERS.includes(user_tier) ? user_tier : 'agent';
  const perms = Array.isArray(custom_permissions) ? custom_permissions : [];
  const deps = Array.isArray(departments) ? departments : [];
  const now = new Date().toISOString();
  const id = uid();
  const token = uid() + uid();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO users (id, email, password, name, user_tier, role, language, custom_permissions, departments, is_active, invite_token, invite_expires, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, email, '', name || email.split('@')[0], tier, tier, 'en', JSON.stringify(perms), JSON.stringify(deps), 0, token, expires, now, now);

  return { id, email, name, token, expires };
}

export function acceptInvite({ token, name, password }) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE invite_token = ?').get(token);
  if (!user) throw new BadRequestError('Invalid or expired invitation link', 'INVITE_INVALID');
  if (user.invite_expires && new Date(user.invite_expires) < new Date()) {
    throw new BadRequestError('Invitation link has expired', 'INVITE_EXPIRED');
  }

  const hashed = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET name = ?, password = ?, is_active = 1, invite_token = NULL, invite_expires = NULL, updated_date = ? WHERE id = ?')
    .run(name, hashed, now, user.id);

  return safeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id));
}

export function createUser({ email, password, name, user_tier, custom_permissions, departments, is_active }) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) throw new ConflictError('Email already registered');

  const tier = VALID_TIERS.includes(user_tier) ? user_tier : 'agent';
  const perms = Array.isArray(custom_permissions) ? custom_permissions : [];
  const deps = Array.isArray(departments) ? departments : [];
  const active = is_active !== undefined ? (is_active ? 1 : 0) : 1;
  const now = new Date().toISOString();
  const hashed = bcrypt.hashSync(password, 10);
  const id = uid();

  db.prepare('INSERT INTO users (id, email, password, name, user_tier, role, language, custom_permissions, departments, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, email, hashed, name, tier, tier, 'en', JSON.stringify(perms), JSON.stringify(deps), active, now, now);

  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}
