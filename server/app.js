import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedDatabase } from './seed.js';
import { getDb, uid, getDataDir } from './db.js';
import { migrationStatus } from './migrations/runner.js';
import fs from 'fs';
import crypto from 'crypto';
import { errorHandler, notFoundHandler, sendError } from './middleware/errors.js';
import { authMiddleware } from './middleware/auth.js';
import { requireAdmin } from './middleware/permissions.js';
import { auditMiddleware } from './services/audit.js';
import logger from './lib/logger.js';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import b2bRoutes from './routes/b2b.js';
import integrationRoutes from './routes/integrations.js';
import ocrRoutes from './routes/ocr.js';
import searchRoutes from './routes/search.js';
import notificationRoutes from './routes/notifications.js';
import documentRoutes from './routes/documents.js';
import pdfRoutes from './routes/pdf.js';
import auditRoutes from './routes/audit.js';
import testingRoutes from './routes/testing.js';
import suggestionRoutes from './routes/suggestions.js';
import reportRoutes from './routes/reports.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

seedDatabase();

const app = express();
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        fontSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://login.microsoftonline.com'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        ...(isProduction && { upgradeInsecureRequests: [] }),
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

app.use(
  cors({
    origin: isProduction ? process.env.CORS_ORIGIN || false : true,
    credentials: true,
  }),
);

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Correlation ID: tags every request/log line/error response with a shared
// id so a user-reported error can be traced back to a specific log line.
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  req.log = logger.child({ requestId: req.id });
  res.setHeader('X-Request-Id', req.id);
  next();
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
});

app.use('/api/auth/login', strictLimiter);
app.use('/api/auth/microsoft', strictLimiter);
app.use('/api/notifications', mutationLimiter);
app.use('/api/documents', mutationLimiter);
app.use('/api/pdf', mutationLimiter);
app.use('/api/testing', mutationLimiter);
app.use('/api', standardLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/entities', auditMiddleware, entityRoutes);
app.use('/api/b2b', auditMiddleware, b2bRoutes);
app.use('/api/integrations', auditMiddleware, integrationRoutes);
app.use('/api/integrations', ocrRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/documents', auditMiddleware, documentRoutes);
app.use('/api/pdf', auditMiddleware, pdfRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/testing', testingRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (req, res) => {
  const checks = { database: 'ok', migrations: 'ok', disk: 'ok' };
  let healthy = true;

  try {
    getDb().prepare('SELECT 1').get();
  } catch (err) {
    checks.database = 'error';
    healthy = false;
  }

  let pendingMigrations = 0;
  try {
    pendingMigrations = migrationStatus(getDb()).filter((m) => !m.applied).length;
    if (pendingMigrations > 0) checks.migrations = 'pending';
  } catch (err) {
    checks.migrations = 'error';
    healthy = false;
  }

  let freeBytes = null;
  try {
    const stats = fs.statfsSync(getDataDir());
    freeBytes = stats.bfree * stats.bsize;
    if (freeBytes < 100 * 1024 * 1024) checks.disk = 'low';
  } catch (err) {
    checks.disk = 'unknown';
  }

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    uptime: process.uptime(),
    checks,
    pendingMigrations,
    diskFreeBytes: freeBytes,
  });
});

app.get('/api/admin/list-users', authMiddleware, requireAdmin, (req, res) => {
  const db = getDb();
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 500);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  const users = db
    .prepare(
      'SELECT id, email, name, user_tier, role, is_active, microsoft_id FROM users ORDER BY created_date LIMIT ? OFFSET ?',
    )
    .all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  res.json({ users, total, limit, offset });
});

// Emergency user fix endpoint — admin only
app.post('/api/admin/fix-user', authMiddleware, requireAdmin, (req, res) => {
  try {
    const { email, user_tier, role } = req.body;
    if (!email) return sendError(res, 400, 'VALIDATION_ERROR', 'email required');
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    if (!user) return sendError(res, 404, 'USER_NOT_FOUND', `User not found: ${email}`);
    const tier = user_tier || 'admin';
    const r = role || tier;
    db.prepare('UPDATE users SET user_tier = ?, role = ?, updated_date = ? WHERE id = ?').run(
      tier,
      r,
      new Date().toISOString(),
      user.id,
    );
    const updated = db
      .prepare('SELECT id, email, name, user_tier, role, is_active FROM users WHERE id = ?')
      .get(user.id);
    res.json({ success: true, user: updated });
  } catch (err) {
    sendError(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

// Fix existing trips where created_by_name = 'Unknown' by looking up the user via created_by email
app.post('/api/admin/fix-trip-agents', authMiddleware, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const trips = db.prepare("SELECT id, data FROM entities WHERE type = 'Trip'").all();
    let fixed = 0;
    for (const row of trips) {
      const data = JSON.parse(row.data);
      if (data.created_by_name === 'Unknown' && data.created_by) {
        const user = db.prepare('SELECT name, phone FROM users WHERE LOWER(email) = LOWER(?)').get(data.created_by);
        if (user && user.name) {
          data.created_by_name = user.name;
          if (user.phone) data.created_by_phone = user.phone;
          db.prepare('UPDATE entities SET data = ? WHERE id = ?').run(JSON.stringify(data), row.id);
          fixed++;
        }
      }
    }
    res.json({ success: true, fixed });
  } catch (err) {
    sendError(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/email/test-outlook', authMiddleware, async (req, res) => {
  try {
    const { sendOutlookEmail, getOutlookStatus } = await import('./services/integrations.js');
    const status = await getOutlookStatus(req.user.id);
    if (!status.connected)
      return sendError(
        res,
        400,
        'OUTLOOK_NOT_CONNECTED',
        'Outlook non connesso. Vai su Impostazioni → Integrazioni per collegarlo.',
      );
    await sendOutlookEmail(req.user.id, {
      to: req.user.email,
      subject: 'Marvelops – Test Outlook',
      body: '<p>Test email inviata tramite Outlook. Funziona correttamente.</p>',
    });
    res.json({ success: true, message: `Email inviata a ${req.user.email}` });
  } catch (err) {
    sendError(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/email/test', authMiddleware, async (req, res) => {
  try {
    const { sendEmail, isSmtpConfigured } = await import('./services/email.js');
    if (!isSmtpConfigured()) {
      return sendError(
        res,
        400,
        'SMTP_NOT_CONFIGURED',
        'SMTP not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS environment variables.',
      );
    }
    const result = await sendEmail({
      to: req.user.email,
      subject: 'Marvelops – Test Email',
      body: '<p>This is a test email from Marvelops. SMTP is working correctly.</p>',
    });
    res.json({ success: true, ...result });
  } catch (err) {
    sendError(res, 500, 'INTERNAL_ERROR', err.message);
  }
});

app.post('/api/app-logs', authMiddleware, (req, res) => {
  try {
    const { pageName } = req.body || {};
    if (pageName) {
      const db = getDb();
      db.prepare('INSERT INTO app_logs (id, page_name, user_id, created_date) VALUES (?, ?, ?, ?)').run(
        uid(),
        pageName,
        req.user?.id || null,
        new Date().toISOString(),
      );
    }
  } catch (e) {
    logger.error({ err: e, pageName: req.body?.pageName }, 'Failed to log page visit');
  }
  res.json({ ok: true });
});

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

const uploadsPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'uploads')
  : path.join(__dirname, '..', 'data', 'uploads');
app.use('/uploads', express.static(uploadsPath));

if (isProduction) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
