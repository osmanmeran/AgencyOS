import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/auth.js';
import logger from '../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isVercel = !!process.env.VERCEL;
const router = Router();

router.use(authMiddleware);

const UPLOAD_DIR = isVercel
  ? path.join('/tmp', 'ocr_uploads')
  : path.join(__dirname, '..', 'ocr_uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function sanitizeFilename(original) {
  const safe = original.replace(/\.\./g, '').replace(/[/\\]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
  return safe.slice(0, 100);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = sanitizeFilename(path.basename(file.originalname, ext));
    cb(null, Date.now() + '_' + safeName + ext);
  }
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.post('/ocr/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ file_path: req.file.path, original_name: req.file.originalname, success: true });
});

router.post('/ocr/extract', (req, res) => {
  const { file_path, lang, parse, supplier_category } = req.body;
  if (!file_path) return res.status(400).json({ error: 'No file_path provided' });

  // Validate file_path is within allowed directories
  const resolved = path.resolve(file_path);
  const allowedDirs = [path.resolve(UPLOAD_DIR)];
  const isAllowed = allowedDirs.some(dir => resolved.startsWith(dir));
  if (!isAllowed) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  if (!fs.existsSync(resolved)) return res.status(400).json({ error: 'File not found on server' });

  const scriptPath = path.join(__dirname, '..', 'ocr_parse.py');
  if (!fs.existsSync(scriptPath)) {
    return res.status(500).json({ error: 'OCR script not found' });
  }

  const parseArgs = {
    path: resolved,
    lang: typeof lang === 'string' && lang.length <= 20 ? lang : 'tur+eng',
    parse: parse !== false,
    supplier_category: typeof supplier_category === 'string' ? supplier_category.slice(0, 50) : null,
  };

  const result = spawnSync('python3', [scriptPath, JSON.stringify(parseArgs)], {
    encoding: 'utf-8',
    timeout: 60000,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    return res.status(500).json({ error: 'OCR process error: ' + result.error.message });
  }
  if (result.stderr) {
    logger.error({ stderr: result.stderr }, 'OCR process stderr');
  }

  try {
    const data = JSON.parse(result.stdout);
    // Clean up the uploaded file after processing
    try { fs.unlinkSync(resolved); } catch (e) {}
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to parse OCR output', raw: result.stdout.substring(0, 2000) });
  }
});

router.post('/ocr/parse-text', (req, res) => {
  const { text, supplier_category } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  // Limit text size to prevent resource exhaustion
  if (text.length > 50000) {
    return res.status(400).json({ error: 'Text too large (max 50000 characters)' });
  }

  const scriptPath = path.join(__dirname, '..', 'ocr_parse.py');
  if (!fs.existsSync(scriptPath)) {
    return res.status(500).json({ error: 'OCR script not found' });
  }

  const tmpFile = path.join(UPLOAD_DIR, '_parse_text_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.txt');
  fs.writeFileSync(tmpFile, text);

  try {
    const parseArgs = {
      path: tmpFile,
      lang: 'tur+eng',
      parse: true,
      supplier_category: typeof supplier_category === 'string' ? supplier_category.slice(0, 50) : null,
    };

    const result = spawnSync('python3', [scriptPath, JSON.stringify(parseArgs)], {
      encoding: 'utf-8',
      timeout: 15000,
      maxBuffer: 5 * 1024 * 1024,
    });

    if (result.error) {
      return res.status(500).json({ error: 'Parse error: ' + result.error.message });
    }
    try {
      res.json(JSON.parse(result.stdout));
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse output', raw: result.stdout.substring(0, 2000) });
    }
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (e) {}
  }
});

export default router;
