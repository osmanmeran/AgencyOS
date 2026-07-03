import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, uid } from '../../server/db.js';
import { getRevenueOverview, getCommissionReport } from '../../server/services/reports.js';

const db = getDb();

function insertEntity(type, data, createdDate) {
  const id = uid();
  const now = createdDate || new Date().toISOString();
  db.prepare('INSERT INTO entities (id, type, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)')
    .run(id, type, JSON.stringify(data), now, now);
  return id;
}

function daysFromNow(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe('Reports Service', () => {
  beforeEach(() => {
    db.prepare(`DELETE FROM entities WHERE type IN ('Trip', 'Invoice', 'Proposal', 'Client', 'ClientPayment')`).run();
  });

  describe('getRevenueOverview', () => {
    it('sums only completed client payments as revenue', () => {
      insertEntity('ClientPayment', { amount: 100, status: 'completed' });
      insertEntity('ClientPayment', { amount: 50, status: 'pending' });

      const overview = getRevenueOverview();
      expect(overview.totalRevenue).toBe(100);
    });

    it('sums outstanding amount_due excluding paid/cancelled invoices', () => {
      insertEntity('Invoice', { status: 'sent', amount_due: 200, due_date: daysFromNow(10) });
      insertEntity('Invoice', { status: 'paid', amount_due: 999, due_date: daysFromNow(10) });
      insertEntity('Invoice', { status: 'cancelled', amount_due: 999, due_date: daysFromNow(10) });

      const overview = getRevenueOverview();
      expect(overview.totalOutstanding).toBe(200);
    });

    it('counts confirmed trips created this month', () => {
      const now = new Date().toISOString();
      insertEntity('Trip', { proposal_status: 'confirmed', total_cost: 500 }, now);
      insertEntity('Trip', { proposal_status: 'draft', total_cost: 999 }, now);

      const overview = getRevenueOverview();
      expect(overview.monthlyConfirmedCount).toBe(1);
      expect(overview.monthlyConfirmedRevenue).toBe(500);
    });

    it('computes proposal accept rate', () => {
      insertEntity('Proposal', { status: 'sent' });
      insertEntity('Proposal', { status: 'accepted' });
      insertEntity('Proposal', { status: 'accepted' });
      insertEntity('Proposal', { status: 'draft' });

      const overview = getRevenueOverview();
      expect(overview.pendingProposals).toBe(1);
      expect(overview.acceptedProposals).toBe(2);
      expect(overview.proposalAcceptRate).toBe(50);
    });

    it('lists upcoming/overdue invoices with resolved client names, limited to 10, sorted by due date', () => {
      const clientId = insertEntity('Client', { name: 'Acme Corp' });
      insertEntity('Invoice', { status: 'sent', client_id: clientId, invoice_number: 'INV-2', due_date: daysFromNow(5), amount_due: 100 });
      insertEntity('Invoice', { status: 'sent', client_id: clientId, invoice_number: 'INV-1', due_date: daysFromNow(-2), amount_due: 50 });
      insertEntity('Invoice', { status: 'paid', client_id: clientId, invoice_number: 'INV-PAID', due_date: daysFromNow(1), amount_due: 0 });

      const overview = getRevenueOverview();
      expect(overview.upcomingPaymentDues).toHaveLength(2);
      expect(overview.upcomingPaymentDues[0].invoice_number).toBe('INV-1');
      expect(overview.upcomingPaymentDues[0].overdue).toBe(true);
      expect(overview.upcomingPaymentDues[0].client_name).toBe('Acme Corp');
      expect(overview.upcomingPaymentDues[1].invoice_number).toBe('INV-2');
      expect(overview.upcomingPaymentDues[1].overdue).toBe(false);
    });

    it('does not include invoices due beyond 30 days', () => {
      insertEntity('Invoice', { status: 'sent', invoice_number: 'FAR', due_date: daysFromNow(60), amount_due: 100 });
      const overview = getRevenueOverview();
      expect(overview.upcomingPaymentDues.find(i => i.invoice_number === 'FAR')).toBeUndefined();
    });
  });

  describe('getCommissionReport', () => {
    it('only includes completed/confirmed trips', () => {
      insertEntity('Trip', { status: 'confirmed', total_cost: 100, final_price: 200, created_by: 'agent-1' });
      insertEntity('Trip', { status: 'draft', total_cost: 100, final_price: 200, created_by: 'agent-1' });

      const report = getCommissionReport();
      expect(report.trips).toHaveLength(1);
    });

    it('uses commission_rate when present, falls back to markup_percentage, then 10%', () => {
      insertEntity('Trip', { status: 'completed', total_cost: 100, final_price: 200, commission_rate: 0.2, created_by: 'a' });
      insertEntity('Trip', { status: 'completed', total_cost: 100, final_price: 200, markup_percentage: 30, created_by: 'a' });
      insertEntity('Trip', { status: 'completed', total_cost: 100, final_price: 200, created_by: 'a' });

      const report = getCommissionReport();
      const rates = report.trips.map(t => t.commissionRate).sort();
      expect(rates).toEqual([0.1, 0.2, 0.3]);
    });

    it('aggregates commission/revenue/trip count by agent', () => {
      insertEntity('Trip', { status: 'completed', total_cost: 100, final_price: 200, commission_rate: 0.1, created_by: 'agent-a' });
      insertEntity('Trip', { status: 'completed', total_cost: 100, final_price: 300, commission_rate: 0.1, created_by: 'agent-a' });
      insertEntity('Trip', { status: 'completed', total_cost: 100, final_price: 400, commission_rate: 0.5, created_by: 'agent-b' });

      const report = getCommissionReport();
      const agentA = report.byAgent.find(a => a.name === 'agent-a');
      const agentB = report.byAgent.find(a => a.name === 'agent-b');
      expect(agentA.trips).toBe(2);
      expect(agentA.commission).toBeCloseTo(10 + 20);
      expect(agentB.commission).toBeCloseTo(150);
    });

    it('groups trips with no created_by under Unassigned', () => {
      insertEntity('Trip', { status: 'completed', total_cost: 0, final_price: 100 });
      const report = getCommissionReport();
      expect(report.byAgent.find(a => a.name === 'Unassigned')).toBeTruthy();
    });

    it('returns zeroed totals when there are no matching trips', () => {
      const report = getCommissionReport();
      expect(report).toMatchObject({ totalCommission: 0, totalProfit: 0, totalRevenue: 0, avgCommissionRate: 0, byAgent: [], trips: [] });
    });
  });
});
