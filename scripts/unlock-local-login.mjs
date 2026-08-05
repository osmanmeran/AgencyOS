#!/usr/bin/env node
// Break-glass access recovery for a single workspace user who is locked out
// because Microsoft SSO is unavailable (e.g. AADSTS50194 while the Azure app
// registration's multi-tenant config is being sorted out).
//
// It does NOT set a password directly — it only clears `microsoft_id` on the
// target account (if set), which is what makes authenticateLocal() reject
// password logins for SSO-provisioned accounts (see server/services/auth.js).
// The account is then finished off through the app's normal reset page, where
// YOU choose the password: this script never generates, prints, or stores one.
//
// Getting to that page needs a reset token. Normally POST /api/auth/forgot-password
// emails it, but that silently no-ops when SMTP_HOST is unset (services/email.js
// falls back to logging, and template emails store an empty body in email_logs,
// so the link is unrecoverable). `--reset-link` therefore mints the same
// one-hour token this flow uses and prints the URL, so recovery works with no
// SMTP configured. Treat that URL like a password until you've used it.
//
// DRY RUN by default: prints what it would do, changes nothing.
// `--apply` performs the update.
// `--create-admin` (only relevant if no user exists for --email yet) also
// creates a new admin-tier account with a blank/unusable password.
// `--reset-link` mints a reset token and prints the URL to set a password.
//   Base URL comes from --url, else APP_URL, else the Railway public domain.
//
// Usage:
//   node scripts/unlock-local-login.mjs --email you@example.com [--tenant 0]
//   node scripts/unlock-local-login.mjs --email you@example.com --apply
//   node scripts/unlock-local-login.mjs --email you@example.com --reset-link --apply
//   node scripts/unlock-local-login.mjs --email you@example.com --create-admin --reset-link --apply

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
  const args = { apply: false, createAdmin: false, resetLink: false, email: null, tenant: '0', url: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--create-admin') args.createAdmin = true;
    else if (a === '--reset-link') args.resetLink = true;
    else if (a === '--email') args.email = argv[++i];
    else if (a === '--tenant') args.tenant = argv[++i];
    else if (a === '--url') args.url = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

/** Base URL for the reset link: explicit --url, else APP_URL, else Railway's public domain. */
function resolveBaseUrl(explicit) {
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null;
  const base = explicit || process.env.APP_URL || railway;
  if (!base) {
    throw new Error('Could not determine the app URL for the reset link. Pass --url https://your-app-domain');
  }
  return String(base).replace(/\/+$/, '');
}

/**
 * Mint the same one-hour reset token requestPasswordReset() would, and return
 * the URL of the page that consumes it. Mirrors services/auth.js — the token is
 * a single-use secret stored as-is, so resetPassword() can match it verbatim.
 */
function mintResetLink(db, userId, baseUrl) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?').run(
    token,
    expires,
    userId,
  );
  return `${baseUrl}/reset-password?token=${token}`;
}

function printResetInstructions(url) {
  console.log('\nOpen this link within the next hour to set your password:');
  console.log(`\n  ${url}\n`);
  console.log('Anyone with that URL can set the password on this account, so keep it to yourself');
  console.log('and do not paste it into a shared channel. It stops working once used or after 1 hour.');
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.email) throw new Error('--email is required, e.g. --email you@example.com');
  const email = String(args.email).trim().toLowerCase();

  const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
  const dbPath =
    args.tenant === '0'
      ? path.join(DATA_DIR, 'tenants', '0', 'marvelops.db')
      : path.join(DATA_DIR, 'tenants', args.tenant, 'marvelops.db');

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Tenant database not found: ${dbPath}`);
  }

  const db = new Database(dbPath);
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email);

  console.log('Local-login unlock plan');
  console.log('========================');
  console.log(`  Tenant DB   : ${dbPath}`);
  console.log(`  Email       : ${email}`);
  console.log(`  Mode        : ${args.apply ? 'APPLY (will modify the database)' : 'DRY RUN (no changes)'}`);
  console.log('');

  if (user) {
    console.log('Found existing user:');
    console.log(`  id         : ${user.id}`);
    console.log(`  name       : ${user.name}`);
    console.log(`  tier       : ${user.user_tier}`);
    console.log(`  active     : ${!!user.is_active}`);
    console.log(`  microsoft_id set : ${!!user.microsoft_id}`);
    console.log(`  has usable password stored : ${!!user.password}`);

    if (!user.microsoft_id) {
      console.log('\nThis account has no microsoft_id set, so it is not blocked from local login.');
      if (!args.resetLink) {
        console.log('Nothing to do. Re-run with --reset-link if you still need to set a password.');
        db.close();
        return;
      }
      if (!args.apply) {
        console.log('\nDRY RUN — no changes made. Re-run with --apply to mint a reset link.');
        db.close();
        return;
      }
      printResetInstructions(mintResetLink(db, user.id, resolveBaseUrl(args.url)));
      db.close();
      return;
    }

    console.log(
      "\nThis account is tied to Microsoft SSO (microsoft_id set), which is why local password " +
        'login is currently rejected for it. Clearing microsoft_id will let it use the normal ' +
        'password-based login and the "Forgot password?" flow.',
    );

    if (!args.apply) {
      console.log('\nDRY RUN — no changes made. Re-run with --apply to clear microsoft_id.');
      if (!args.resetLink) {
        console.log('Add --reset-link to also mint a link for setting a password (no SMTP needed).');
      }
      db.close();
      return;
    }

    // Resolve the base URL before writing, so a bad/missing --url fails the run
    // instead of leaving the account unlinked with no way to finish.
    const baseUrl = args.resetLink ? resolveBaseUrl(args.url) : null;

    db.prepare('UPDATE users SET microsoft_id = NULL, updated_date = ? WHERE id = ?').run(
      new Date().toISOString(),
      user.id,
    );
    console.log('\nDone. microsoft_id cleared.');

    if (baseUrl) printResetInstructions(mintResetLink(db, user.id, baseUrl));
    else {
      console.log('Next: re-run with --reset-link --apply to get a link for setting a password,');
      console.log('or use "Forgot password?" on the login page if SMTP is configured.');
    }
    db.close();
    return;
  }

  console.log('No user found for that email in this tenant.');
  if (!args.createAdmin) {
    console.log('Re-run with --create-admin to create a new admin-tier account for this email.');
    db.close();
    return;
  }

  console.log('\nWould create a new admin-tier account:');
  console.log(`  email : ${email}`);
  console.log('  tier  : admin');
  console.log('  password : (blank/unusable — set via the forgot-password flow after creation)');

  if (!args.apply) {
    console.log('\nDRY RUN — no changes made. Re-run with --apply to create this account.');
    if (!args.resetLink) {
      console.log('Add --reset-link to also mint a link for setting its password (no SMTP needed).');
    }
    db.close();
    return;
  }

  // Resolve before inserting, so a bad/missing --url fails the run rather than
  // leaving a passwordless account behind with no way to finish.
  const baseUrl = args.resetLink ? resolveBaseUrl(args.url) : null;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO users (id, email, password, name, user_tier, role, language, custom_permissions, departments, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
  ).run(id, email, '', email.split('@')[0], 'admin', 'admin', 'en', '[]', '[]', now, now);

  console.log(`\nDone. Created admin account ${id} for ${email}.`);

  if (baseUrl) printResetInstructions(mintResetLink(db, id, baseUrl));
  else {
    console.log('Next: re-run with --reset-link --apply to get a link for setting a password,');
    console.log('or use "Forgot password?" on the login page if SMTP is configured.');
  }
  db.close();
}

main();
