// Symmetric encryption for secrets stored at rest (e.g. a tenant's own Stripe
// API key in stripe_settings — see services/stripeSettings.js). AES-256-GCM
// with a random IV per call; ciphertext, IV, and auth tag are packed into one
// string so the column stays a single TEXT field.
import crypto from 'crypto';
import logger from './logger.js';

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

function loadKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (raw) {
    const key = Buffer.from(raw, 'hex');
    if (key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    return key;
  }
  logger.error('ENCRYPTION_KEY is not set. Set it in .env for persistence.');
  // Ephemeral fallback so the app can still start, same convention as
  // JWT_SECRET in middleware/auth.js — but note the consequence here is worse
  // than an invalidated session: anything encrypted under this key becomes
  // permanently undecryptable once the process restarts with a *different*
  // generated key. Set ENCRYPTION_KEY explicitly in any persistent environment.
  const generated = crypto.randomBytes(32).toString('hex');
  process.env.ENCRYPTION_KEY = generated;
  return Buffer.from(generated, 'hex');
}

let cachedKey = null;
function getKey() {
  if (!cachedKey) cachedKey = loadKey();
  return cachedKey;
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/** Encrypts `plaintext` with AES-256-GCM. Passes `null`/`undefined` through unchanged. */
export function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + [iv, authTag, ciphertext].map((buf) => buf.toString('hex')).join(':');
}

/**
 * Decrypts a value produced by {@link encrypt}. `null`/`undefined` pass
 * through unchanged, and a value without the `enc:v1:` prefix is returned
 * as-is rather than rejected — this lets callers read a row mid-migration
 * (before the backfill in 029_encrypt_stripe_secrets.js has encrypted it)
 * without special-casing every read site.
 */
export function decrypt(value) {
  if (value === null || value === undefined) return value;
  if (!isEncrypted(value)) return value;
  const [ivHex, authTagHex, ciphertextHex] = value.slice(PREFIX.length).split(':');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]).toString('utf8');
}
