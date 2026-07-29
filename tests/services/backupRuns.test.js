import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getPlatformDb } from '../../server/db.js';

// Alerting goes through the email service; mock it so these tests assert who we
// notify and when, without SMTP.
const sentEmails = [];
vi.mock('../../server/services/email.js', () => ({
  sendEmail: vi.fn(async (payload) => {
    sentEmails.push(payload);
    return { status: 'sent' };
  }),
  isSmtpConfigured: vi.fn(() => true),
}));

const { sendEmail, isSmtpConfigured } = await import('../../server/services/email.js');
const { recordBackupRun, lastBackupRun, lastSuccessfulBackupRun, backupHealth, alertRecipients, alertOnFailure } =
  await import('../../server/services/backupRuns.js');

const OK = [
  { scope: 'tenants/0', label: 'primary workspace', ok: true },
  { scope: 'platform', label: 'platform registry', ok: true },
];

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

beforeEach(() => {
  getPlatformDb().exec('DELETE FROM backup_runs');
  sentEmails.length = 0;
  vi.mocked(isSmtpConfigured).mockReturnValue(true);
  delete process.env.BACKUP_ALERT_EMAIL;
  delete process.env.PLATFORM_ADMIN_EMAILS;
});

afterEach(() => {
  delete process.env.BACKUP_ALERT_EMAIL;
  delete process.env.PLATFORM_ADMIN_EMAILS;
});

describe('recording backup runs', () => {
  it('stores a successful run and reads it back', () => {
    const run = recordBackupRun({ startedAt: hoursAgo(0), results: OK, offsite: true });
    expect(run.ok).toBe(1);
    expect(run.total).toBe(2);
    expect(run.failed).toBe(0);

    const last = lastBackupRun();
    expect(last.ok).toBe(true);
    expect(last.offsite).toBe(true);
    expect(last.detail).toHaveLength(2);
  });

  it('counts failures and keeps the failing detail', () => {
    const run = recordBackupRun({
      startedAt: hoursAgo(0),
      results: [...OK, { scope: 'tenants/x', label: 'Acme', ok: false, error: 'disk full' }],
      offsite: false,
    });
    expect(run.ok).toBe(0);
    expect(run.failed).toBe(1);
    expect(backupHealth().failures).toEqual([{ scope: 'tenants/x', label: 'Acme', error: 'disk full' }]);
  });

  it('tracks the last *successful* run separately from the last run', () => {
    recordBackupRun({ startedAt: hoursAgo(3), results: OK, offsite: false });
    recordBackupRun({
      startedAt: hoursAgo(1),
      results: [{ scope: 'tenants/0', ok: false, error: 'boom' }],
      offsite: false,
    });

    expect(lastBackupRun().ok).toBe(false);
    expect(lastSuccessfulBackupRun().started_at).toBe(
      // the older, successful one
      getPlatformDb().prepare('SELECT started_at FROM backup_runs WHERE ok = 1').get().started_at,
    );
  });
});

describe('backupHealth staleness', () => {
  it('reports stale when nothing has ever run — the silent-scheduler case', () => {
    const health = backupHealth();
    expect(health.lastRunAt).toBeNull();
    expect(health.stale).toBe(true);
    expect(health.ok).toBe(false);
  });

  it('is not stale right after a successful run', () => {
    recordBackupRun({ startedAt: hoursAgo(0), results: OK, offsite: true });
    expect(backupHealth().stale).toBe(false);
  });

  it('is stale when the last success is older than the threshold', () => {
    recordBackupRun({ startedAt: hoursAgo(31), results: OK, offsite: true });
    expect(backupHealth().stale).toBe(true);
  });

  it('a recent failure with no recent success is stale', () => {
    recordBackupRun({ startedAt: hoursAgo(40), results: OK, offsite: false });
    recordBackupRun({ startedAt: hoursAgo(1), results: [{ scope: 'x', ok: false, error: 'e' }], offsite: false });
    const health = backupHealth();
    expect(health.ok).toBe(false);
    expect(health.stale).toBe(true);
  });
});

describe('alert recipients', () => {
  it('prefers BACKUP_ALERT_EMAIL, falls back to platform admins, else empty', () => {
    expect(alertRecipients()).toEqual([]);
    process.env.PLATFORM_ADMIN_EMAILS = 'ops@marvelops.app, second@marvelops.app';
    expect(alertRecipients()).toEqual(['ops@marvelops.app', 'second@marvelops.app']);
    process.env.BACKUP_ALERT_EMAIL = 'backups@marvelops.app';
    expect(alertRecipients()).toEqual(['backups@marvelops.app']);
  });
});

describe('alertOnFailure', () => {
  it('does not email when every target succeeded', async () => {
    process.env.BACKUP_ALERT_EMAIL = 'ops@marvelops.app';
    const run = recordBackupRun({ startedAt: hoursAgo(0), results: OK, offsite: true });
    expect(await alertOnFailure({ ...run, detail: OK })).toBe(false);
    expect(sentEmails).toHaveLength(0);
  });

  it('emails the operator listing each failed target', async () => {
    process.env.BACKUP_ALERT_EMAIL = 'ops@marvelops.app';
    const results = [...OK, { scope: 'tenants/x', label: 'Acme Travel', ok: false, error: 'disk full' }];
    const run = recordBackupRun({ startedAt: hoursAgo(0), results, offsite: true });

    expect(await alertOnFailure({ ...run, detail: results })).toBe(true);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toEqual(['ops@marvelops.app']);
    expect(sentEmails[0].subject).toMatch(/1 backup failure/);
    expect(sentEmails[0].body).toContain('Acme Travel');
    expect(sentEmails[0].body).toContain('disk full');
  });

  it('does not throw when there is nobody to alert', async () => {
    const results = [{ scope: 'tenants/x', ok: false, error: 'nope' }];
    const run = recordBackupRun({ startedAt: hoursAgo(0), results, offsite: false });
    expect(await alertOnFailure({ ...run, detail: results })).toBe(false);
    expect(sentEmails).toHaveLength(0);
  });

  it('does not throw when SMTP is unavailable', async () => {
    process.env.BACKUP_ALERT_EMAIL = 'ops@marvelops.app';
    vi.mocked(isSmtpConfigured).mockReturnValue(false);
    const results = [{ scope: 'tenants/x', ok: false, error: 'nope' }];
    const run = recordBackupRun({ startedAt: hoursAgo(0), results, offsite: false });
    expect(await alertOnFailure({ ...run, detail: results })).toBe(false);
  });

  it('swallows an email failure rather than breaking the backup job', async () => {
    process.env.BACKUP_ALERT_EMAIL = 'ops@marvelops.app';
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('smtp exploded'));
    const results = [{ scope: 'tenants/x', ok: false, error: 'nope' }];
    const run = recordBackupRun({ startedAt: hoursAgo(0), results, offsite: false });
    expect(await alertOnFailure({ ...run, detail: results })).toBe(false);
  });
});
