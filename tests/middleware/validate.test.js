import { describe, it, expect } from 'vitest';
import { validate, schemas } from '../../server/middleware/validate.js';

describe('Validation Schemas', () => {
  describe('login', () => {
    it('should accept valid login', () => {
      const result = schemas.login.safeParse({ email: 'test@test.com', password: 'password' });
      expect(result.success).toBe(true);
    });

    it('should reject missing email', () => {
      const result = schemas.login.safeParse({ password: 'password' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = schemas.login.safeParse({ email: 'not-an-email', password: 'password' });
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const result = schemas.login.safeParse({ email: 'test@test.com' });
      expect(result.success).toBe(false);
    });
  });

  describe('microsoftAuth', () => {
    it('should accept valid idToken', () => {
      const result = schemas.microsoftAuth.safeParse({ idToken: 'token123' });
      expect(result.success).toBe(true);
    });

    it('should reject missing idToken', () => {
      const result = schemas.microsoftAuth.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('createUser', () => {
    it('should accept valid user data', () => {
      const result = schemas.createUser.safeParse({
        email: 'new@test.com',
        password: 'StrongPass1',
        name: 'New User',
      });
      expect(result.success).toBe(true);
    });

    it('should reject weak password', () => {
      const result = schemas.createUser.safeParse({
        email: 'new@test.com',
        password: 'weak',
        name: 'New User',
      });
      expect(result.success).toBe(false);
    });

    it('should reject password without uppercase', () => {
      const result = schemas.createUser.safeParse({
        email: 'new@test.com',
        password: 'alllowercase1',
        name: 'New User',
      });
      expect(result.success).toBe(false);
    });

    it('should apply default tier', () => {
      const result = schemas.createUser.safeParse({
        email: 'new@test.com',
        password: 'StrongPass1',
        name: 'New User',
      });
      expect(result.data.user_tier).toBe('agent');
    });
  });

  describe('exchangeRate', () => {
    it('should accept valid currency codes', () => {
      const result = schemas.exchangeRate.safeParse({ from: 'USD', to: 'EUR' });
      expect(result.success).toBe(true);
    });

    it('should reject short codes', () => {
      const result = schemas.exchangeRate.safeParse({ from: 'US', to: 'EUR' });
      expect(result.success).toBe(false);
    });
  });

  describe('sendEmail', () => {
    it('should accept valid email', () => {
      const result = schemas.sendEmail.safeParse({ to: 'test@test.com', subject: 'Hello' });
      expect(result.success).toBe(true);
    });

    it('should accept array of recipients', () => {
      const result = schemas.sendEmail.safeParse({
        to: ['a@test.com', 'b@test.com'],
        subject: 'Hello',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing subject', () => {
      const result = schemas.sendEmail.safeParse({ to: 'test@test.com' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = schemas.sendEmail.safeParse({ to: 'not-an-email', subject: 'Hello' });
      expect(result.success).toBe(false);
    });
  });

  describe('sendEmailTemplate', () => {
    it('should accept valid template email', () => {
      const result = schemas.sendEmailTemplate.safeParse({
        to: 'test@test.com',
        subject: 'Your Proposal',
        template: 'proposal',
        templateData: { clientName: 'John', destination: 'Paris' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid template name', () => {
      const result = schemas.sendEmailTemplate.safeParse({
        to: 'test@test.com',
        subject: 'Test',
        template: 'nonexistent',
      });
      expect(result.success).toBe(false);
    });

    it('should accept template without templateData', () => {
      const result = schemas.sendEmailTemplate.safeParse({
        to: 'test@test.com',
        subject: 'Hello',
        template: 'generic',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('outlookConnect', () => {
    it('should accept valid data', () => {
      const result = schemas.outlookConnect.safeParse({
        token_data: { access_token: 'token123', refresh_token: 'refresh123', expires_in: 3600 },
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing access_token', () => {
      const result = schemas.outlookConnect.safeParse({
        token_data: { refresh_token: 'refresh123' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validate middleware', () => {
    it('should call next on valid data', () => {
      const middleware = validate(schemas.login);
      const req = { body: { email: 'test@test.com', password: 'pass' } };
      const res = { status: () => ({ json: () => {} }) };
      let called = false;
      middleware(req, res, () => { called = true; });
      expect(called).toBe(true);
    });

    it('should return error on invalid data', () => {
      const middleware = validate(schemas.login);
      const req = { body: { email: 'invalid' } };
      let statusCode, jsonData;
      const res = {
        status: (code) => {
          statusCode = code;
          return { json: (data) => { jsonData = data; } };
        }
      };
      middleware(req, res, () => {});
      expect(statusCode).toBe(400);
      expect(jsonData.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
