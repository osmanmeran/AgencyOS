import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import logger from '../lib/logger.js';

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
    { id: user.id, email: user.email, user_tier: user.user_tier, role: user.role },
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
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}
