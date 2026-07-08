import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

const currSymbol = (cur) =>
  ({
    USD: '$',
    EUR: '€',
    GBP: '£',
    TRY: '₺',
    AED: 'د.إ',
    SAR: '﷼',
    EGP: 'E£',
    MAD: 'MAD',
    JPY: '¥',
    CHF: 'CHF',
    CAD: 'CA$',
    AUD: 'A$',
  })[cur] ||
  cur ||
  '$';

export default function TripCostSummary({ trip }) {
  const { t } = useT();
  // Build supplier service rows from SupplierService entity (actual vs budgeted)
  // Also incorporate trip.services array for selling prices
  const tripServices = (trip.services || []).slice().sort((a, b) => {
    const aStart = a.start_date || '';
    const bStart = b.start_date || '';
    if (aStart < bStart) return -1;
    if (aStart > bStart) return 1;
    const aEnd = a.end_date || '';
    const bEnd = b.end_date || '';
    if (aEnd < bEnd) return -1;
    if (aEnd > bEnd) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  // Calculate from trip services (acquiring = budgeted cost per unit)
  const effQty = (svc) => {
    const qty = parseInt(svc.quantity) || 1;
    if (svc.unit === 'per_night' || svc.unit === 'per_day') {
      if (svc.start_date && svc.end_date) {
        const days = Math.max(1, Math.round((+new Date(svc.end_date) - +new Date(svc.start_date)) / 86400000));
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
      marginPct: budgeted > 0 ? ((selling - budgeted) / budgeted) * 100 : null,
      unit: svc.unit || 'per_person',
    };
  });

  const totalBudgeted = rows.reduce((s, r) => s + r.budgetedCost, 0);
  const totalSelling = rows.reduce((s, r) => s + r.sellingPrice, 0);
  const totalMargin = totalSelling - totalBudgeted;
  const totalMarginPct = totalBudgeted > 0 ? (totalMargin / totalBudgeted) * 100 : null;

  const sc = currSymbol(trip.selling_currency || 'USD');
  const ac = currSymbol(trip.acquiring_currency || 'USD');

  if (rows.length === 0) {
    return (
      <Card className="p-6 bg-card shadow-lg">
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-300" />
          {t('tripCostSummary.title')}
        </h2>
        <p className="text-muted-foreground text-center py-4">{t('tripCostSummary.noServicesYet')}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-card shadow-lg print:shadow-none">
      <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-300" />
        {t('tripCostSummary.title')}
      </h2>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">{t('tripCostSummary.totalBudgetedCost')}</div>
          <div className="text-2xl font-bold text-amber-800 dark:text-amber-300">
            {ac}
            {totalBudgeted.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{t('tripCostSummary.budgetedHint')}</div>
        </div>
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">{t('tripCostSummary.totalSellingPrice')}</div>
          <div className="text-2xl font-bold text-green-800 dark:text-green-300">
            {sc}
            {totalSelling.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{t('tripCostSummary.sellingHint')}</div>
        </div>
        <div
          className={`rounded-lg p-4 border ${totalMargin >= 0 ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800' : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800'}`}
        >
          <div className="text-xs text-muted-foreground mb-1">{t('tripCostSummary.grossMargin')}</div>
          <div
            className={`text-2xl font-bold ${totalMargin >= 0 ? 'text-blue-800 dark:text-blue-300' : 'text-red-800 dark:text-red-300'} flex items-center gap-1`}
          >
            {totalMargin >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            {sc}
            {Math.abs(totalMargin).toFixed(2)}
          </div>
          {totalMarginPct !== null && (
            <div
              className={`text-xs mt-1 font-medium ${totalMargin >= 0 ? 'text-blue-600 dark:text-blue-300' : 'text-red-600 dark:text-red-300'}`}
            >
              {t('tripCostSummary.marginSuffix', {
                pct: `${totalMarginPct >= 0 ? '+' : ''}${totalMarginPct.toFixed(1)}`,
              })}
            </div>
          )}
        </div>
      </div>

      {/* Service Breakdown Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-3 text-muted-foreground font-medium">{t('tripCostSummary.tableService')}</th>
              <th className="pb-3 text-muted-foreground font-medium">{t('tripCostSummary.tableCategory')}</th>
              <th className="pb-3 text-muted-foreground font-medium text-center">{t('tripCostSummary.tableQty')}</th>
              <th className="pb-3 text-muted-foreground font-medium text-right">
                {t('tripCostSummary.tableBudgetedCost')}
              </th>
              <th className="pb-3 text-muted-foreground font-medium text-right">
                {t('tripCostSummary.tableSellingPrice')}
              </th>
              <th className="pb-3 text-muted-foreground font-medium text-right">{t('tripCostSummary.tableMargin')}</th>
              <th className="pb-3 text-muted-foreground font-medium text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isProfit = row.margin >= 0;
              return (
                <tr key={row.idx} className="border-b border-border hover:bg-muted">
                  <td className="py-3 pr-3">
                    <span className="font-medium text-foreground">{row.name}</span>
                    <div className="text-xs text-muted-foreground">{row.unit?.replace(/_/g, ' ')}</div>
                  </td>
                  <td className="py-3 pr-3">
                    {row.category !== '—' ? (
                      <Badge className="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs">
                        {row.category}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 text-center text-foreground">{row.qty}</td>
                  <td className="py-3 text-right text-amber-700 dark:text-amber-300 font-medium">
                    {currSymbol(row.currency)}
                    {row.budgetedCost.toFixed(2)}
                  </td>
                  <td className="py-3 text-right text-green-700 dark:text-green-300 font-medium">
                    {currSymbol(row.clientCurrency)}
                    {row.sellingPrice.toFixed(2)}
                  </td>
                  <td
                    className={`py-3 text-right font-medium ${isProfit ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}
                  >
                    {isProfit ? '+' : ''}
                    {currSymbol(row.clientCurrency)}
                    {row.margin.toFixed(2)}
                  </td>
                  <td className="py-3 text-right">
                    {row.marginPct !== null ? (
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${isProfit ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'}`}
                      >
                        {row.marginPct >= 0 ? '+' : ''}
                        {row.marginPct.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-bold">
              <td className="pt-4 text-foreground" colSpan={3}>
                {t('tripCostSummary.totalLabel')}
              </td>
              <td className="pt-4 text-right text-amber-800 dark:text-amber-300">
                {ac}
                {totalBudgeted.toFixed(2)}
              </td>
              <td className="pt-4 text-right text-green-800 dark:text-green-300">
                {sc}
                {totalSelling.toFixed(2)}
              </td>
              <td
                className={`pt-4 text-right ${totalMargin >= 0 ? 'text-blue-800 dark:text-blue-300' : 'text-red-800 dark:text-red-300'}`}
              >
                {totalMargin >= 0 ? '+' : ''}
                {sc}
                {totalMargin.toFixed(2)}
              </td>
              <td className="pt-4 text-right">
                {totalMarginPct !== null && (
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${totalMargin >= 0 ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300' : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'}`}
                  >
                    {totalMarginPct >= 0 ? '+' : ''}
                    {totalMarginPct.toFixed(1)}%
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Health indicator */}
      <div
        className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${totalMargin >= 0 ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'}`}
      >
        {totalMargin >= 0 ? (
          <>
            <CheckCircle className="w-4 h-4" />{' '}
            {t('tripCostSummary.profitableMessage', { amount: `${sc}${totalMargin.toFixed(2)}` })}
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4" />{' '}
            {t('tripCostSummary.warningMessage', { amount: `${sc}${Math.abs(totalMargin).toFixed(2)}` })}
          </>
        )}
      </div>
    </Card>
  );
}
