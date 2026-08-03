import 'dotenv/config';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-not-for-production';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
