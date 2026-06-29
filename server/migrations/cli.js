import 'dotenv/config';
import { getDb } from '../db.js';
import { migrate, migrationStatus } from './runner.js';

const command = process.argv[2];

function main() {
  const db = getDb();

  switch (command) {
    case 'up': {
      const applied = migrate(db, { direction: 'up' });
      if (applied.length === 0) process.exit(0);
      process.exit(0);
    }

    case 'down': {
      const rolledBack = migrate(db, { direction: 'down' });
      process.exit(rolledBack.length > 0 ? 0 : 0);
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
          console.log(s.name.padEnd(maxLen + 2) + (s.applied ? '✓ Applied' : '○ Pending'));
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
