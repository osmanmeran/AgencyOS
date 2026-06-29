import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedDatabase } from './seed.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { auditMiddleware } from './services/audit.js';
import logger from './lib/logger.js';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import integrationRoutes from './routes/integrations.js';
import ocrRoutes from './routes/ocr.js';
import searchRoutes from './routes/search.js';
import notificationRoutes from './routes/notifications.js';
import documentRoutes from './routes/documents.js';
import pdfRoutes from './routes/pdf.js';
import auditRoutes from './routes/audit.js';
import testingRoutes from './routes/testing.js';
import suggestionRoutes from './routes/suggestions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

seedDatabase();

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
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
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: isProduction ? process.env.CORS_ORIGIN || false : true,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  message: { message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});

app.use('/api/auth/login', strictLimiter);
app.use('/api/auth/microsoft', strictLimiter);
app.use('/api/notifications', mutationLimiter);
app.use('/api/documents', mutationLimiter);
app.use('/api/pdf', mutationLimiter);
app.use('/api', standardLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/entities', auditMiddleware, entityRoutes);
app.use('/api/integrations', auditMiddleware, integrationRoutes);
app.use('/api/integrations', ocrRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/documents', auditMiddleware, documentRoutes);
app.use('/api/pdf', auditMiddleware, pdfRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/testing', testingRoutes);
app.use('/api/suggestions', suggestionRoutes);

// On Vercel, static files + SPA fallback are handled by vercel.json
// Only serve static files + SPA on non-Vercel environments
if (!process.env.VERCEL) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));

  const uploadsPath = path.join(__dirname, 'uploads');
  app.use('/uploads', express.static(uploadsPath));

  if (isProduction) {
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
