import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { migrate, migrationStatus } from './runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'marvelops.db');

const command = process.argv[2];

function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  switch (command) {
    case 'up': {
      const applied = migrate(db, { direction: 'up' });
      process.exit(0);
    }

    case 'down': {
      const rolledBack = migrate(db, { direction: 'down' });
      process.exit(0);
    }

    case 'status': {
      const statuses = migrationStatus(db);
      if (statuses.length === 0) {
        console.log('No migration files found.');
      } else {
        const maxLen = Math.max(...statuses.map(s => s.name.length), 10);
        console.log('Migration'.padEnd(maxLen + 2) + 'Status');
        console.log('-'.repeat(maxLen + 2) + '--------');
        for (const s of statuses) {
          console.log(s.name.padEnd(maxLen + 2) + (s.applied ? '\u2713 Applied' : '\u25CB Pending'));
        }
      }
      process.exit(0);
    }

    default: {
      console.log('Usage: node server/migrations/cli.js <up|down|status>');
      process.exit(1);
    }
  }
}

main();
