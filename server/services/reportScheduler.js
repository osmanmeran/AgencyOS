import { getDb } from '../db.js';
import logger from '../lib/logger.js';
import { getRevenueOverview, getCommissionReport } from './reports.js';
import { sendEmail } from './email.js';

let intervalHandle = null;

/** Run an immediate pass over due report schedules, then repeat it every 60 minutes. */
export function startReportScheduler() {
  logger.info('Report scheduler started');

  const check = () => {
    runDueSchedules().catch((err) => logger.error({ err }, 'Report scheduler check error'));
  };

  check();
  intervalHandle = setInterval(check, 60 * 60 * 1000);
  logger.info('Report scheduler scheduled (every 60 minutes)');
}

/** Cancel the scheduled report-check interval, if running. */
export function stopReportScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('Report scheduler stopped');
  }
}

const FREQUENCY_MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

function isDue(schedule) {
  if (!schedule.last_sent_date) return true;
  const elapsed = Date.now() - new Date(schedule.last_sent_date).getTime();
  return elapsed >= (FREQUENCY_MS[schedule.frequency] || FREQUENCY_MS.weekly);
}

function money(n) {
  return `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderCommissionsHtml(data) {
  const rows = data.trips
    .map(
      (t) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${t.name || ''}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${t.client_name || ''}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${money(t.final_price)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${money(t.commission)}</td>
    </tr>`,
    )
    .join('');

  return `
    <h2 style="margin-top:0;">Commission Report</h2>
    <p>Total revenue: <strong>${money(data.totalRevenue)}</strong> &middot;
       Total profit: <strong>${money(data.totalProfit)}</strong> &middot;
       Total commission: <strong>${money(data.totalCommission)}</strong></p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="text-align:left;background:#f8fafc;">
          <th style="padding:6px 10px;">Trip</th><th style="padding:6px 10px;">Client</th>
          <th style="padding:6px 10px;">Revenue</th><th style="padding:6px 10px;">Commission</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="4" style="padding:10px;">No data for this period</td></tr>'}</tbody>
    </table>`;
}

function renderRevenueOverviewHtml(data) {
  return `
    <h2 style="margin-top:0;">Revenue Overview</h2>
    <p>Total revenue: <strong>${money(data.totalRevenue)}</strong></p>
    <p>Outstanding: <strong>${money(data.totalOutstanding)}</strong></p>
    <p>Confirmed this month: <strong>${money(data.monthlyConfirmedRevenue)}</strong>
       (${data.monthlyConfirmedCount} reservation${data.monthlyConfirmedCount === 1 ? '' : 's'})</p>
    <p>Proposal accept rate: <strong>${data.proposalAcceptRate}%</strong></p>`;
}

function reportPayload(reportType) {
  if (reportType === 'commissions') {
    return { subject: 'Commission Report', html: renderCommissionsHtml(getCommissionReport()) };
  }
  return { subject: 'Revenue Overview', html: renderRevenueOverviewHtml(getRevenueOverview()) };
}

/**
 * Send any active `ReportSchedule` whose frequency interval has elapsed since
 * `last_sent_date`, then stamp it with the new send time. Exported (not just
 * used via start/stop) so callers — including tests — can trigger and await
 * a single pass deterministically.
 */
export async function runDueSchedules() {
  const db = getDb();
  const rows = db.prepare(`SELECT id, data FROM entities WHERE type = 'ReportSchedule'`).all();

  for (const row of rows) {
    let schedule;
    try {
      schedule = JSON.parse(row.data);
    } catch {
      continue;
    }
    if (!schedule.active) continue;
    if (!isDue(schedule)) continue;

    const recipients = (schedule.recipients || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (recipients.length === 0) continue;

    const { subject, html } = reportPayload(schedule.report_type);

    try {
      await sendEmail({ to: recipients, subject: `Marvelops — ${subject}`, body: html });
      const now = new Date().toISOString();
      db.prepare('UPDATE entities SET data = ?, updated_date = ? WHERE id = ?').run(
        JSON.stringify({ ...schedule, last_sent_date: now }),
        now,
        row.id,
      );
      logger.info({ scheduleId: row.id, reportType: schedule.report_type }, 'Scheduled report sent');
    } catch (err) {
      logger.error({ err: err.message, scheduleId: row.id }, 'Failed to send scheduled report');
    }
  }
}
