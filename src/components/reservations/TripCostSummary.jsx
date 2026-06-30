import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';

const currSymbol = (cur) => ({ USD: '$', EUR: '€', GBP: '£', TRY: '₺', AED: 'د.إ', SAR: '﷼', EGP: 'E£', MAD: 'MAD', JPY: '¥', CHF: 'CHF', CAD: 'CA$', AUD: 'A$' }[cur] || (cur || '$'));

export default function TripCostSummary({ trip }) {

  // Build supplier service rows from SupplierService entity (actual vs budgeted)
  // Also incorporate trip.services array for selling prices
  const tripServices = (trip.services || []).slice().sort((a, b) => {
    const aStart = a.start_date || ''; const bStart = b.start_date || '';
    if (aStart < bStart) return -1; if (aStart > bStart) return 1;
    const aEnd = a.end_date || ''; const bEnd = b.end_date || '';
    if (aEnd < bEnd) return -1; if (aEnd > bEnd) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  // Calculate from trip services (acquiring = budgeted cost per unit)
  const effQty = (svc) => {
    const qty = parseInt(svc.quantity) || 1;
    if (svc.unit === 'per_night' || svc.unit === 'per_day') {
      if (svc.start_date && svc.end_date) {
        const days = Math.max(1, Math.round((+(new Date(svc.end_date)) - +(new Date(svc.start_date))) / 86400000));
        return qty * days;
      }
      return qty;
    }
    return qty;
  };
  const rows = tripServices.map((svc, idx) => {
    const qty = effQty(svc);
    const budgeted = (parseFloat(svc.acquiring_price) || 0) * qty;
    const selling = (parseFloat(svc.selling_price) || 0) * qty;
    // actual_cost not stored on trip services, will show budgeted as actual unless SupplierService record found
    return {
      idx,
      name: svc.name || `Service ${idx + 1}`,
      category: svc.category || '—',
      qty,
      currency: svc.supplier_currency || 'USD',
      clientCurrency: svc.client_currency || 'USD',
      budgetedCost: budgeted,
      sellingPrice: selling,
      margin: selling - budgeted,
      marginPct: budgeted > 0 ? ((selling - budgeted) / budgeted * 100) : null,
      unit: svc.unit || 'per_person',
    };
  });

  const totalBudgeted = rows.reduce((s, r) => s + r.budgetedCost, 0);
  const totalSelling = rows.reduce((s, r) => s + r.sellingPrice, 0);
  const totalMargin = totalSelling - totalBudgeted;
  const totalMarginPct = totalBudgeted > 0 ? (totalMargin / totalBudgeted * 100) : null;

  const sc = currSymbol(trip.selling_currency || 'USD');
  const ac = currSymbol(trip.acquiring_currency || 'USD');

  if (rows.length === 0) {
    return (
      <Card className="p-6 bg-white shadow-lg">
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-blue-600" />Trip Cost Summary
        </h2>
        <p className="text-slate-500 text-center py-4">No services to summarize yet.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-white shadow-lg print:shadow-none">
      <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-blue-600" />Trip Cost Summary
      </h2>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-xs text-slate-500 mb-1">Total Budgeted Cost</div>
          <div className="text-2xl font-bold text-amber-800">{ac}{totalBudgeted.toFixed(2)}</div>
          <div className="text-xs text-slate-400 mt-1">Sum of all supplier costs</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-xs text-slate-500 mb-1">Total Selling Price</div>
          <div className="text-2xl font-bold text-green-800">{sc}{totalSelling.toFixed(2)}</div>
          <div className="text-xs text-slate-400 mt-1">Sum of all client prices</div>
        </div>
        <div className={`rounded-lg p-4 border ${totalMargin >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
          <div className="text-xs text-slate-500 mb-1">Gross Margin</div>
          <div className={`text-2xl font-bold ${totalMargin >= 0 ? 'text-blue-800' : 'text-red-800'} flex items-center gap-1`}>
            {totalMargin >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            {sc}{Math.abs(totalMargin).toFixed(2)}
          </div>
          {totalMarginPct !== null && (
            <div className={`text-xs mt-1 font-medium ${totalMargin >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {totalMarginPct >= 0 ? '+' : ''}{totalMarginPct.toFixed(1)}% margin
            </div>
          )}
        </div>
      </div>

      {/* Service Breakdown Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="pb-3 text-slate-500 font-medium">Service</th>
              <th className="pb-3 text-slate-500 font-medium">Category</th>
              <th className="pb-3 text-slate-500 font-medium text-center">Qty</th>
              <th className="pb-3 text-slate-500 font-medium text-right">Budgeted Cost</th>
              <th className="pb-3 text-slate-500 font-medium text-right">Selling Price</th>
              <th className="pb-3 text-slate-500 font-medium text-right">Margin</th>
              <th className="pb-3 text-slate-500 font-medium text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isProfit = row.margin >= 0;
              return (
                <tr key={row.idx} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 pr-3">
                    <span className="font-medium text-slate-900">{row.name}</span>
                    <div className="text-xs text-slate-400">{row.unit?.replace(/_/g, ' ')}</div>
                  </td>
                  <td className="py-3 pr-3">
                    {row.category !== '—' ? (
                      <Badge className="bg-purple-100 text-purple-700 text-xs">{row.category}</Badge>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="py-3 text-center text-slate-700">{row.qty}</td>
                  <td className="py-3 text-right text-amber-700 font-medium">
                    {currSymbol(row.currency)}{row.budgetedCost.toFixed(2)}
                  </td>
                  <td className="py-3 text-right text-green-700 font-medium">
                    {currSymbol(row.clientCurrency)}{row.sellingPrice.toFixed(2)}
                  </td>
                  <td className={`py-3 text-right font-medium ${isProfit ? 'text-blue-700' : 'text-red-700'}`}>
                    {isProfit ? '+' : ''}{currSymbol(row.clientCurrency)}{row.margin.toFixed(2)}
                  </td>
                  <td className="py-3 text-right">
                    {row.marginPct !== null ? (
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isProfit ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                        {row.marginPct >= 0 ? '+' : ''}{row.marginPct.toFixed(1)}%
                      </span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-bold">
              <td className="pt-4 text-slate-900" colSpan={3}>TOTAL</td>
              <td className="pt-4 text-right text-amber-800">{ac}{totalBudgeted.toFixed(2)}</td>
              <td className="pt-4 text-right text-green-800">{sc}{totalSelling.toFixed(2)}</td>
              <td className={`pt-4 text-right ${totalMargin >= 0 ? 'text-blue-800' : 'text-red-800'}`}>
                {totalMargin >= 0 ? '+' : ''}{sc}{totalMargin.toFixed(2)}
              </td>
              <td className="pt-4 text-right">
                {totalMarginPct !== null && (
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${totalMargin >= 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                    {totalMarginPct >= 0 ? '+' : ''}{totalMarginPct.toFixed(1)}%
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Health indicator */}
      <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${totalMargin >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
        {totalMargin >= 0
          ? <><CheckCircle className="w-4 h-4" /> This trip is profitable with a {sc}{totalMargin.toFixed(2)} gross margin.</>
          : <><AlertTriangle className="w-4 h-4" /> Warning: selling price is below cost by {sc}{Math.abs(totalMargin).toFixed(2)}.</>
        }
      </div>
    </Card>
  );
}