import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, uid } from '../../server/db.js';

const db = getDb();

import { runDueSchedules } from '../../server/services/reportScheduler.js';

function insertSchedule(overrides = {}) {
  const id = uid();
  const now = new Date().toISOString();
  const data = {
    report_type: 'revenue_overview',
    frequency: 'weekly',
    recipients: 'agent@example.com',
    active: true,
    ...overrides,
  };
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
    id,
    'ReportSchedule',
    JSON.stringify(data),
    now,
    now,
  );
  return id;
}

function getSchedule(id) {
  const row = db.prepare('SELECT data FROM entities WHERE id = ?').get(id);
  return JSON.parse(row.data);
}

function emailsTo(address) {
  return db.prepare('SELECT * FROM email_logs WHERE to_email = ?').all(address);
}

function insertTrip(overrides = {}) {
  const id = uid();
  const now = new Date().toISOString();
  const data = {
    status: 'confirmed',
    final_price: 1000,
    total_cost: 800,
    ...overrides,
  };
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)').run(
    id,
    'Trip',
    JSON.stringify(data),
    now,
    now,
  );
  return id;
}

describe('Report Scheduler', () => {
  beforeEach(() => {
    db.prepare(`DELETE FROM entities WHERE type = 'ReportSchedule'`).run();
    db.prepare(`DELETE FROM entities WHERE type = 'Trip'`).run();
  });

  it('sends a due schedule with no last_sent_date and stamps last_sent_date', async () => {
    const id = insertSchedule({ recipients: 'due-first-run@example.com' });

    await runDueSchedules();

    expect(emailsTo('due-first-run@example.com')).toHaveLength(1);
    expect(getSchedule(id).last_sent_date).toBeTruthy();
  });

  it('does not send an inactive schedule', async () => {
    insertSchedule({ active: false, recipients: 'inactive@example.com' });

    await runDueSchedules();

    expect(emailsTo('inactive@example.com')).toHaveLength(0);
  });

  it('does not resend a weekly schedule sent an hour ago', async () => {
    insertSchedule({
      recipients: 'recent-weekly@example.com',
      frequency: 'weekly',
      last_sent_date: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });

    await runDueSchedules();

    expect(emailsTo('recent-weekly@example.com')).toHaveLength(0);
  });

  it('resends a daily schedule last sent 2 days ago', async () => {
    insertSchedule({
      recipients: 'overdue-daily@example.com',
      frequency: 'daily',
      last_sent_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });

    await runDueSchedules();

    expect(emailsTo('overdue-daily@example.com')).toHaveLength(1);
  });

  it('sends the commission report variant with commission-specific content', async () => {
    insertSchedule({ report_type: 'commissions', recipients: 'commissions-report@example.com' });

    await runDueSchedules();

    const emails = emailsTo('commissions-report@example.com');
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toContain('Commission Report');
  });

  it('skips a schedule with no recipients', async () => {
    const id = insertSchedule({ recipients: '' });

    await runDueSchedules();

    expect(getSchedule(id).last_sent_date).toBeUndefined();
  });

  it('escapes trip/client names in the commission report HTML body', async () => {
    insertTrip({ name: '<img src=x onerror=alert(1)>', client_name: 'A & B "Travel"' });
    insertSchedule({ report_type: 'commissions', recipients: 'commissions-xss@example.com' });

    await runDueSchedules();

    const emails = emailsTo('commissions-xss@example.com');
    expect(emails).toHaveLength(1);
    expect(emails[0].body).not.toContain('<img src=x onerror=alert(1)>');
    expect(emails[0].body).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(emails[0].body).toContain('A &amp; B &quot;Travel&quot;');
  });

  it('supports multiple comma-separated recipients', async () => {
    insertSchedule({ recipients: 'multi-a@example.com, multi-b@example.com' });

    await runDueSchedules();

    expect(emailsTo('multi-a@example.com, multi-b@example.com')).toHaveLength(1);
  });
});
