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
import { tenantMiddleware } from './middleware/tenant.js';
import { tenantStatusMiddleware } from './middleware/tenantStatus.js';
import { csrfMiddleware } from './middleware/csrf.js';
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
import uploadRoutes from './routes/uploads.js';
import pdfRoutes from './routes/pdf.js';
import auditRoutes from './routes/audit.js';
import testingRoutes from './routes/testing.js';
import suggestionRoutes from './routes/suggestions.js';
import reportRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import taskRoutes from './routes/tasks.js';
import tenantRoutes from './routes/tenants.js';
import platformRoutes from './routes/platform.js';
import tripShareRoutes from './routes/tripShare.js';
import publicItineraryRoutes from './routes/publicItinerary.js';
import paymentRoutes from './routes/payments.js';
import stripeWebhookRoutes from './routes/stripeWebhook.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

seedDatabase();

const app = express();
app.set('trust proxy', 1);

// Stripe webhook: needs the *raw* request body for signature verification, and
// Stripe's request carries no Host subdomain or session cookie for
// tenantMiddleware/csrfMiddleware/authMiddleware to key off — so this route
// runs before every one of those, rather than carving out an exception in each.
// Tenant routing instead comes from the connected-account id on the event
// itself (see routes/stripeWebhook.js).
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookRoutes);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        fontSrc: ["'self'", 'data:', 'https:'],
        connectSrc: [
          "'self'",
          'https://cdn.jsdelivr.net',
          'https://login.microsoftonline.com',
          'https://nominatim.openstreetmap.org',
        ],
        frameSrc: ["'self'", 'https://maps.google.com', 'https://www.google.com'],
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
app.use(csrfMiddleware);

// Correlation ID: tags every request/log line/error response with a shared
// id so a user-reported error can be traced back to a specific log line.
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  req.log = logger.child({ requestId: req.id });
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Resolve the tenant from the Host header (subdomain) before auth runs, and
// scope the request to that tenant's database. See SAAS_PROJECT.md, Phase 2.
app.use(tenantMiddleware);

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
// Self-serve workspace signup is abuse-sensitive: keep it on the strict limiter.
app.use('/api/tenants/signup', strictLimiter);
app.use('/api/notifications', mutationLimiter);
app.use('/api/documents', mutationLimiter);
app.use('/api/pdf', mutationLimiter);
app.use('/api/testing', mutationLimiter);
app.use('/api/payments', mutationLimiter);
// Unauthenticated: rate-limit by IP against share-token guessing, but stay
// generous enough for a family reopening the same link over a couple of weeks.
const publicShareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
});
app.use('/api/public/itinerary', publicShareLimiter);
app.use('/api', standardLimiter);

// Lifecycle gate: a suspended workspace (or one whose trial has lapsed) can
// still authenticate and read its own status, but nothing else.
app.use('/api', tenantStatusMiddleware);

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
// Admin fix endpoints mutate user tiers and entity data, so they must leave
// an audit trail like every other mutating route.
app.use('/api/admin', auditMiddleware, adminRoutes);
app.use('/api/tasks', auditMiddleware, taskRoutes);
// Self-serve workspace provisioning (Phase 3). Public + unauthenticated — it
// must NOT sit behind authMiddleware (there is no session to scope it to yet).
app.use('/api/tenants', tenantRoutes);

// Platform (SaaS operator) admin: cross-tenant workspace list + stats. Auth +
// allow-list gated inside the router.
app.use('/api/platform', platformRoutes);

app.use('/api/payments', auditMiddleware, paymentRoutes);
app.use('/api/trips', auditMiddleware, tripShareRoutes);
// Public itinerary link: deliberately unauthenticated (see routes/publicItinerary.js)
// — a passenger with no account opens this straight from a shared URL.
app.use('/api/public/itinerary', publicItineraryRoutes);

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

app.post('/api/email/test-outlook', authMiddleware, async (req, res) => {
  try {
    const { sendOutlookEmail, getOutlookStatus } = await import('./services/integrations.js');
    const status = await getOutlookStatus(req.user.id);
    if (!status.connected)
      return sendError(
        res,
        400,
        'OUTLOOK_NOT_CONNECTED',
        'Outlook not connected. Go to Settings → Integrations to connect it.',
      );
    await sendOutlookEmail(req.user.id, {
      to: req.user.email,
      subject: 'Marvelops – Test Outlook',
      body: '<p>Test email sent via Outlook. It works correctly.</p>',
    });
    res.json({ success: true, message: `Email sent to ${req.user.email}` });
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

// Uploaded files are NOT static-served: /uploads goes through an authenticated,
// tenant-scoped, permission-checked route (server/routes/uploads.js).
app.use('/uploads', uploadRoutes);

if (isProduction) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
