import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { getTenantDataDir } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendError } from '../middleware/errors.js';
import logger from '../lib/logger.js';
import { sanitizeFilename } from '../lib/sanitizeFilename.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// OCR shells out to a Python script (ocr_parse.py) that depends on python3,
// pytesseract and pdf2image — none of which exist in a default Node/Railway
// image. The feature is opt-in so the routes degrade cleanly (instead of
// returning opaque 500s) wherever those system deps aren't provisioned.
const OCR_ENABLED = process.env.OCR_ENABLED === 'true';

router.use(authMiddleware);

if (!OCR_ENABLED) {
  router.use((req, res) => {
    sendError(
      res,
      503,
      'OCR_DISABLED',
      'OCR is disabled on this server. Set OCR_ENABLED=true and install python3, pytesseract and pdf2image to use it.',
    );
  });
}

// Scratch space for files awaiting OCR, per tenant: /ocr/extract takes a
// caller-supplied path, so a shared directory would let one workspace name
// (and consume) another's pending upload in the window before it's parsed.
function ocrUploadDir() {
  const dir = path.join(getTenantDataDir(), 'ocr_uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ocrUploadDir()),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = sanitizeFilename(path.basename(file.originalname, ext));
    cb(null, Date.now() + '_' + safeName + ext);
  },
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.post('/ocr/upload', upload.single('file'), (req, res) => {
  if (!req.file) return sendError(res, 400, 'NO_FILE', 'No file uploaded');
  res.json({ file_path: req.file.path, original_name: req.file.originalname, success: true });
});

function runOcrScript(scriptPath, args, timeout, maxBuffer) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [scriptPath, JSON.stringify(args)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (fn, arg) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        fn(arg);
      }
    };
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      finish(reject, new Error('OCR process timed out'));
    }, timeout);

    const overBuffer = () => maxBuffer && Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > maxBuffer;
    proc.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (overBuffer()) {
        proc.kill('SIGTERM');
        finish(reject, new Error('OCR process output exceeded maxBuffer'));
      }
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (overBuffer()) {
        proc.kill('SIGTERM');
        finish(reject, new Error('OCR process output exceeded maxBuffer'));
      }
    });
    proc.on('error', (err) => finish(reject, err));
    proc.on('close', (code) => {
      if (code !== 0) {
        finish(reject, new Error(stderr || `Process exited with code ${code}`));
      } else {
        finish(resolve, { stdout, stderr });
      }
    });
  });
}

router.post('/ocr/extract', async (req, res) => {
  try {
    const { file_path, lang, parse, supplier_category } = req.body;
    if (!file_path) return sendError(res, 400, 'NO_FILE_PATH', 'No file_path provided');

    const resolved = path.resolve(file_path);
    const allowedDirs = [path.resolve(ocrUploadDir())];
    const isAllowed = allowedDirs.some((dir) => resolved.startsWith(dir));
    if (!isAllowed) {
      return sendError(res, 400, 'INVALID_FILE_PATH', 'Invalid file path');
    }

    if (!fs.existsSync(resolved)) return sendError(res, 400, 'FILE_NOT_FOUND', 'File not found on server');

    const scriptPath = path.join(__dirname, '..', 'ocr_parse.py');
    if (!fs.existsSync(scriptPath)) {
      return sendError(res, 500, 'SCRIPT_NOT_FOUND', 'OCR script not found');
    }

    const parseArgs = {
      path: resolved,
      lang: typeof lang === 'string' && lang.length <= 20 ? lang : 'tur+eng',
      parse: parse !== false,
      supplier_category: typeof supplier_category === 'string' ? supplier_category.slice(0, 50) : null,
    };

    const result = await runOcrScript(scriptPath, parseArgs, 60000, 10 * 1024 * 1024);

    if (result.stderr) {
      logger.warn({ stderr: result.stderr }, 'OCR process stderr');
    }

    const data = JSON.parse(result.stdout);
    try {
      fs.unlinkSync(resolved);
    } catch (e) {}
    res.json(data);
  } catch (e) {
    if (e.message === 'Failed to parse OCR output' || e instanceof SyntaxError) {
      res.status(500).json({
        error: { code: 'PARSE_ERROR', message: 'Failed to parse OCR output' },
        raw: e.stdout?.substring(0, 2000),
      });
    } else {
      sendError(res, 500, 'OCR_PROCESS_ERROR', e.message);
    }
  }
});

router.post('/ocr/parse-text', async (req, res) => {
  let tmpFile = '';
  try {
    const { text, supplier_category } = req.body;
    if (!text) return sendError(res, 400, 'NO_TEXT', 'No text provided');

    if (text.length > 50000) {
      return sendError(res, 400, 'TEXT_TOO_LARGE', 'Text too large (max 50000 characters)');
    }

    const scriptPath = path.join(__dirname, '..', 'ocr_parse.py');
    if (!fs.existsSync(scriptPath)) {
      return sendError(res, 500, 'SCRIPT_NOT_FOUND', 'OCR script not found');
    }

    tmpFile = path.join(
      ocrUploadDir(),
      '_parse_text_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.txt',
    );
    fs.writeFileSync(tmpFile, text);

    const parseArgs = {
      path: tmpFile,
      lang: 'tur+eng',
      parse: true,
      supplier_category: typeof supplier_category === 'string' ? supplier_category.slice(0, 50) : null,
    };

    const result = await runOcrScript(scriptPath, parseArgs, 15000, 5 * 1024 * 1024);
    res.json(JSON.parse(result.stdout));
  } catch (e) {
    if (e instanceof SyntaxError) {
      res.status(500).json({ error: { code: 'PARSE_ERROR', message: 'Failed to parse output' } });
    } else {
      sendError(res, 500, 'PARSE_ERROR', e.message);
    }
  } finally {
    if (tmpFile) {
      try {
        fs.unlinkSync(tmpFile);
      } catch (e) {}
    }
  }
});

export default router;
