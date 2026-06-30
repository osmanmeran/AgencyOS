import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join('/tmp', 'logs');

const isProduction = process.env.NODE_ENV === 'production';

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const transport = isProduction
  ? pino.transport({
      targets: [
        {
          target: 'pino/file',
          options: { destination: path.join(LOG_DIR, 'app.log'), mkdir: true },
        },
        {
          target: 'pino/file',
          options: { destination: path.join(LOG_DIR, 'error.log'), mkdir: true },
          level: 'error',
        },
      ],
    })
  : pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
      },
    });

const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    redact: ['req.headers.authorization', 'req.body.password', 'req.body.new_password', 'req.body.current_password'],
  },
  transport,
);

export default logger;
