import { getDb } from '../db.js';

function num(x) {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

/**
 * Build the dashboard revenue summary: collected revenue, outstanding invoice
 * balance, this month's confirmed trip revenue, proposal accept rate, and
 * upcoming payment dues in the next 30 days.
 * @returns {object} Revenue overview metrics.
 */
export function getRevenueOverview() {
  const db = getDb();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEndExclusive = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const todayStr = now.toISOString().slice(0, 10);
  const next30Str = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const totalRevenue = db
    .prepare(
      `
    SELECT COALESCE(SUM(json_extract(data, '$.amount')), 0) AS total FROM entities
    WHERE type = 'ClientPayment' AND json_extract(data, '$.status') = 'completed'
  `,
    )
    .get().total;

  const totalOutstanding = db
    .prepare(
      `
    SELECT COALESCE(SUM(json_extract(data, '$.amount_due')), 0) AS total FROM entities
    WHERE type = 'Invoice' AND json_extract(data, '$.status') NOT IN ('paid', 'cancelled')
  `,
    )
    .get().total;

  const confirmedThisMonth = db
    .prepare(
      `
    SELECT COUNT(*) AS count, COALESCE(SUM(json_extract(data, '$.total_cost')), 0) AS total FROM entities
    WHERE type = 'Trip' AND json_extract(data, '$.proposal_status') = 'confirmed'
    AND created_date >= ? AND created_date < ?
  `,
    )
    .get(monthStart, monthEndExclusive);

  const proposalCounts = db
    .prepare(
      `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN json_extract(data, '$.status') = 'sent' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN json_extract(data, '$.status') = 'accepted' THEN 1 ELSE 0 END) AS accepted
    FROM entities WHERE type = 'Proposal'
  `,
    )
    .get();

  const upcomingRows = db
    .prepare(
      `
    SELECT id, data FROM entities WHERE type = 'Invoice'
    AND json_extract(data, '$.status') NOT IN ('paid', 'cancelled')
    AND json_extract(data, '$.due_date') <= ?
    ORDER BY json_extract(data, '$.due_date') ASC
    LIMIT 10
  `,
    )
    .all(next30Str);

  const clientIds = [...new Set(upcomingRows.map((r) => JSON.parse(r.data).client_id).filter(Boolean))];
  const clientNames = {};
  if (clientIds.length) {
    const placeholders = clientIds.map(() => '?').join(',');
    db.prepare(`SELECT id, data FROM entities WHERE type = 'Client' AND id IN (${placeholders})`)
      .all(...clientIds)
      .forEach((r) => {
        clientNames[r.id] = JSON.parse(r.data).name;
      });
  }

  const upcomingPaymentDues = upcomingRows.map((r) => {
    const inv = JSON.parse(r.data);
    return {
      id: r.id,
      invoice_number: inv.invoice_number,
      due_date: inv.due_date,
      currency: inv.currency || 'USD',
      amount_due: num(inv.amount_due),
      client_name: clientNames[inv.client_id] || 'Unknown',
      overdue: inv.due_date < todayStr,
    };
  });

  const proposalAcceptRate =
    proposalCounts.total > 0 ? Math.round((proposalCounts.accepted / proposalCounts.total) * 100) : 0;

  return {
    totalRevenue: num(totalRevenue),
    totalOutstanding: num(totalOutstanding),
    monthlyConfirmedRevenue: num(confirmedThisMonth.total),
    monthlyConfirmedCount: confirmedThisMonth.count,
    pendingProposals: proposalCounts.pending || 0,
    acceptedProposals: proposalCounts.accepted || 0,
    proposalAcceptRate,
    upcomingPaymentDues,
  };
}

/**
 * Compute per-trip and per-agent commission from completed/confirmed trips,
 * using each trip's explicit `commission_rate`, or its `markup_percentage`
 * converted to a decimal rate, or a 10% default.
 * @returns {object} Totals plus per-trip and per-agent breakdowns.
 */
export function getCommissionReport() {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT id, data FROM entities WHERE type = 'Trip'
    AND json_extract(data, '$.status') IN ('completed', 'confirmed')
  `,
    )
    .all();

  const trips = rows.map((r) => {
    const t = JSON.parse(r.data);
    const cost = num(t.total_cost);
    const price = num(t.final_price);
    const profit = price - cost;
    const commissionRate =
      t.commission_rate != null ? t.commission_rate : t.markup_percentage ? t.markup_percentage / 100 : 0.1;
    const commission = profit * commissionRate;
    return {
      id: r.id,
      name: t.name,
      client_name: t.client_name,
      destination: t.destination,
      currency: t.selling_currency || 'USD',
      final_price: price,
      profit,
      commissionRate,
      commission,
      agent: t.created_by || 'Unassigned',
    };
  });

  const totals = trips.reduce(
    (acc, t) => {
      acc.totalCommission += t.commission;
      acc.totalProfit += t.profit;
      acc.totalRevenue += t.final_price;
      acc.rateSum += t.commissionRate;
      return acc;
    },
    { totalCommission: 0, totalProfit: 0, totalRevenue: 0, rateSum: 0 },
  );

  const avgCommissionRate = trips.length ? totals.rateSum / trips.length : 0;

  const byAgentMap = {};
  for (const t of trips) {
    if (!byAgentMap[t.agent]) byAgentMap[t.agent] = { name: t.agent, commission: 0, revenue: 0, trips: 0 };
    byAgentMap[t.agent].commission += t.commission;
    byAgentMap[t.agent].revenue += t.final_price;
    byAgentMap[t.agent].trips += 1;
  }
  const byAgent = Object.values(byAgentMap).sort((a, b) => b.commission - a.commission);

  return {
    totalCommission: totals.totalCommission,
    totalProfit: totals.totalProfit,
    totalRevenue: totals.totalRevenue,
    avgCommissionRate,
    byAgent,
    trips,
  };
}
