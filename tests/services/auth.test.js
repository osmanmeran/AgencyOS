import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { getDb, runWithTenant } from '../../server/db.js';
import { createTenant } from '../../server/services/tenants.js';
import {
  authenticateLocal,
  safeUser,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  getAllUsers,
  VALID_TIERS,
  requestPasswordReset,
  locatePasswordReset,
  resetPassword,
  createRefreshToken,
  findValidRefreshToken,
} from '../../server/services/auth.js';

describe('Auth Service', () => {
  beforeAll(() => {
    getDb();
  });

  describe('safeUser', () => {
    it('should strip sensitive fields', () => {
      const user = {
        id: '1',
        email: 'test@test.com',
        password: 'secret',
        name: 'Test',
        user_tier: 'agent',
        role: 'agent',
        language: 'en',
        custom_permissions: '[]',
        departments: '[]',
        client_id: null,
        linked_supplier_id: null,
        is_active: 1,
        created_date: '2024-01-01',
      };
      const result = safeUser(user);
      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe('test@test.com');
    });
  });

  describe('authenticateLocal', () => {
    it('should reject invalid email', () => {
      expect(() => authenticateLocal('nonexistent@test.com', 'password123')).toThrow('Invalid email or password');
    });

    it('should reject wrong password', () => {
      expect(() => authenticateLocal('admin@travelpro.com', 'wrongpassword')).toThrow('Invalid email or password');
    });

    it('should reject local password login for SSO-linked accounts, even with a matching hash', () => {
      const db = getDb();
      const now = new Date().toISOString();
      const oid = 'ms-oid-12345';
      // Model a legacy SSO-provisioned row whose password is bcrypt(oid)
      db.prepare(
        'INSERT INTO users (id, email, password, name, user_tier, role, microsoft_id, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      ).run('sso-user-1', 'sso-test@test.com', bcrypt.hashSync(oid, 10), 'SSO User', 'agent', 'agent', oid, now, now);

      expect(() => authenticateLocal('sso-test@test.com', oid)).toThrow('Microsoft sign-in');
      db.prepare('DELETE FROM users WHERE id = ?').run('sso-user-1');
    });

    it('should reject accounts with an empty (unusable) password', () => {
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO users (id, email, password, name, user_tier, role, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
      ).run('nopw-user-1', 'nopw-test@test.com', '', 'No Password', 'agent', 'agent', now, now);

      expect(() => authenticateLocal('nopw-test@test.com', '')).toThrow('Invalid email or password');
      db.prepare('DELETE FROM users WHERE id = ?').run('nopw-user-1');
    });

    it('disambiguates the same email across workspaces by which password verifies', () => {
      const email = 'shared-email@test.com';
      const tenant = createTenant({ slug: 'dup-email-ws', name: 'Dup Email WS' });

      createUser({ email, password: 'DefaultTenantPw1', name: 'Tenant Zero' });
      runWithTenant(tenant.id, () => {
        createUser({ email, password: 'OtherTenantPw1', name: 'Other Tenant' });
      });

      // With no workspace context, the password decides which workspace the
      // session lands in — the first-registered match must not always win.
      const zero = authenticateLocal(email, 'DefaultTenantPw1');
      expect(zero.tenantId).toBe('0');
      const other = authenticateLocal(email, 'OtherTenantPw1');
      expect(other.tenantId).toBe(tenant.id);
      expect(() => authenticateLocal(email, 'NeitherPw1')).toThrow('Invalid email or password');

      getDb().prepare('DELETE FROM users WHERE email = ?').run(email);
      runWithTenant(tenant.id, () => {
        getDb().prepare('DELETE FROM users WHERE email = ?').run(email);
      });
    });
  });

  describe('createUser', () => {
    it('should create a new user', () => {
      const email = `test-${Date.now()}@test.com`;
      const user = createUser({ email, password: 'TestPass1', name: 'Test User' });
      expect(user.email).toBe(email);
      expect(user.name).toBe('Test User');
      expect(user.user_tier).toBe('agent');
      expect(bcrypt.compareSync('TestPass1', user.password)).toBe(true);
    });

    it('should reject duplicate email', () => {
      const email = `dup-${Date.now()}@test.com`;
      createUser({ email, password: 'TestPass1', name: 'First' });
      expect(() => createUser({ email, password: 'TestPass2', name: 'Second' })).toThrow('Email already registered');
    });

    it('should normalize email casing/whitespace on create', () => {
      const base = `Case-${Date.now()}@Test.com`;
      const user = createUser({ email: `  ${base}  `, password: 'TestPass1', name: 'Case Test' });
      expect(user.email).toBe(base.toLowerCase());
    });

    it('should treat differently-cased emails as duplicates', () => {
      const base = `Mixed-${Date.now()}@Test.com`;
      createUser({ email: base, password: 'TestPass1', name: 'First' });
      expect(() => createUser({ email: base.toUpperCase(), password: 'TestPass2', name: 'Second' })).toThrow(
        'Email already registered',
      );
    });

    it('should authenticate regardless of email casing', () => {
      const base = `Login-${Date.now()}@Test.com`;
      createUser({ email: base, password: 'TestPass1', name: 'Login Test' });
      expect(authenticateLocal(base.toUpperCase(), 'TestPass1').user.email).toBe(base.toLowerCase());
    });
  });

  describe('getUserById', () => {
    it('should return null for missing user', () => {
      expect(getUserById('nonexistent')).toBeNull();
    });

    it('should return existing user', () => {
      const email = `getbyid-${Date.now()}@test.com`;
      const created = createUser({ email, password: 'TestPass1', name: 'Get Test' });
      const found = getUserById(created.id);
      expect(found.email).toBe(email);
    });
  });

  describe('updateUser', () => {
    it('should update user fields', () => {
      const email = `update-${Date.now()}@test.com`;
      const created = createUser({ email, password: 'TestPass1', name: 'Before' });
      const updated = updateUser(created.id, { name: 'After' });
      expect(updated.name).toBe('After');
    });

    it('should update password', () => {
      const email = `pass-${Date.now()}@test.com`;
      const created = createUser({ email, password: 'TestPass1', name: 'Pass Test' });
      updateUser(created.id, { password: 'NewPass123' });
      const found = getUserById(created.id);
      expect(bcrypt.compareSync('NewPass123', found.password)).toBe(true);
    });

    it('should return null with no fields', () => {
      const email = `nofields-${Date.now()}@test.com`;
      const created = createUser({ email, password: 'TestPass1', name: 'No Fields' });
      expect(updateUser(created.id, {})).toBeNull();
    });
  });

  describe('deleteUser', () => {
    it('should delete a user', () => {
      const email = `delete-${Date.now()}@test.com`;
      const created = createUser({ email, password: 'TestPass1', name: 'Delete Me' });
      deleteUser(created.id);
      expect(getUserById(created.id)).toBeNull();
    });
  });

  describe('getAllUsers', () => {
    it('should return all users', () => {
      const users = getAllUsers();
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
    });
  });

  describe('requestPasswordReset / resetPassword', () => {
    it('returns null for an unknown email without creating a token', () => {
      expect(requestPasswordReset(`nobody-${Date.now()}@test.com`)).toBeNull();
    });

    it('returns null for an inactive account', () => {
      const email = `inactive-${Date.now()}@test.com`;
      const created = createUser({ email, password: 'TestPass1', name: 'Inactive' });
      updateUser(created.id, { is_active: false });
      expect(requestPasswordReset(email)).toBeNull();
    });

    it('returns null for an SSO-linked account (no usable local password to reset)', () => {
      const db = getDb();
      const now = new Date().toISOString();
      const email = `sso-reset-${Date.now()}@test.com`;
      db.prepare(
        'INSERT INTO users (id, email, password, name, user_tier, role, microsoft_id, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      ).run(`sso-reset-${Date.now()}`, email, '', 'SSO User', 'agent', 'agent', 'ms-oid-reset-test', now, now);
      expect(requestPasswordReset(email)).toBeNull();
    });

    it('issues a token for an active, password-based account and resets the password with it', () => {
      const email = `reset-${Date.now()}@test.com`;
      const created = createUser({ email, password: 'OldPass123', name: 'Reset Me' });

      const result = requestPasswordReset(email);
      expect(result).toMatchObject({ email, name: 'Reset Me' });
      expect(result.token).toBeTruthy();

      const located = locatePasswordReset(result.token);
      expect(located.user.id).toBe(created.id);

      resetPassword({ token: result.token, newPassword: 'NewPass456' });

      const found = getUserById(created.id);
      expect(bcrypt.compareSync('NewPass456', found.password)).toBe(true);
      expect(bcrypt.compareSync('OldPass123', found.password)).toBe(false);
      expect(found.password_reset_token).toBeNull();

      // The token is single-use.
      expect(locatePasswordReset(result.token)).toBeNull();
      expect(authenticateLocal(email, 'NewPass456').user.email).toBe(email);
    });

    it('revokes every existing refresh token for the account on reset', () => {
      const email = `reset-revoke-${Date.now()}@test.com`;
      const created = createUser({ email, password: 'OldPass123', name: 'Revoke Me' });
      const raw = createRefreshToken(created.id, {});
      expect(findValidRefreshToken(raw)).toBeTruthy();

      const { token } = requestPasswordReset(email);
      resetPassword({ token, newPassword: 'NewPass456' });

      expect(findValidRefreshToken(raw)).toBeNull();
    });

    it('rejects an invalid/unknown reset token', () => {
      expect(() => resetPassword({ token: 'not-a-real-token', newPassword: 'NewPass456' })).toThrow(
        /Invalid or expired/,
      );
    });

    it('rejects an expired reset token', () => {
      const email = `reset-expired-${Date.now()}@test.com`;
      const created = createUser({ email, password: 'OldPass123', name: 'Expired' });
      const { token } = requestPasswordReset(email);
      // Force the token into the past.
      getDb()
        .prepare('UPDATE users SET password_reset_expires = ? WHERE id = ?')
        .run(new Date(Date.now() - 1000).toISOString(), created.id);

      expect(() => resetPassword({ token, newPassword: 'NewPass456' })).toThrow(/expired/);
    });
  });
});
