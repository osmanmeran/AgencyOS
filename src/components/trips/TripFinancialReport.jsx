import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Receipt, Calculator, Save, Percent } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

export default function TripFinancialReport({ trip, events, invoices }) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [markupPercentage, setMarkupPercentage] = useState(trip.markup_percentage || 0);

  const totalExpenses = events.reduce((sum, e) => sum + (e.cost || 0), 0);
  const markupAmount = totalExpenses * (markupPercentage / 100);
  const finalPrice = totalExpenses + markupAmount;

  const tripInvoices = invoices.filter((i) => i.trip_id === trip.id);
  //   const totalInvoiced = tripInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
  const totalPaid = tripInvoices.reduce((sum, i) => sum + (i.amount_paid || 0), 0);
  //   const totalOutstanding = tripInvoices.reduce((sum, i) => sum + (i.amount_due || 0), 0);

  const profit = totalPaid - totalExpenses;
  const profitMargin = totalPaid > 0 ? (profit / totalPaid) * 100 : 0;

  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () =>
        db.entities.Trip.update(trip.id, {
          ...trip,
          total_expenses: totalExpenses,
          markup_percentage: markupPercentage,
          final_price: finalPrice,
        }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trip', trip.id] }),
    })
  );

  // Group expenses by supplier
  /* expensesBySupplier removed (unused) */

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-slate-500 to-slate-600 text-white">
          <div className="text-sm opacity-80 mb-1">{t('tripFinancialReport.totalExpenses')}</div>
          <div className="text-2xl font-bold">${totalExpenses.toFixed(2)}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="text-sm opacity-80 mb-1">{t('tripFinancialReport.finalPrice')}</div>
          <div className="text-2xl font-bold">${finalPrice.toFixed(2)}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="text-sm opacity-80 mb-1">{t('tripFinancialReport.paid')}</div>
          <div className="text-2xl font-bold">${totalPaid.toFixed(2)}</div>
        </Card>
        <Card
          className={`p-4 bg-gradient-to-br ${profit >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-red-500 to-red-600'} text-white`}
        >
          <div className="text-sm opacity-80 mb-1">{t('tripFinancialReport.profit')}</div>
          <div className="text-2xl font-bold">${profit.toFixed(2)}</div>
          <div className="text-xs opacity-80">
            {t('tripFinancialReport.marginLabel', { percent: profitMargin.toFixed(1) })}
          </div>
        </Card>
      </div>

      {/* Markup Calculator */}
      <Card className="p-6 bg-card">
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-600 dark:text-blue-300" />
          {t('tripFinancialReport.priceCalculator')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <Label className="text-sm text-muted-foreground">{t('tripFinancialReport.totalExpenses')}</Label>
            <div className="text-2xl font-bold text-foreground">${totalExpenses.toFixed(2)}</div>
          </div>
          <div className="space-y-2">
            <Label>{t('tripFinancialReport.markupPercent')}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={markupPercentage}
                onChange={(e) => setMarkupPercentage(parseFloat(e.target.value) || 0)}
                className="w-24"
              />
              <Percent className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">{t('tripFinancialReport.markupAmount')}</Label>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-300">+${markupAmount.toFixed(2)}</div>
          </div>
          <div className="flex items-center gap-2">
            <div>
              <Label className="text-sm text-muted-foreground">{t('tripFinancialReport.finalPrice')}</Label>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">${finalPrice.toFixed(2)}</div>
            </div>
            <Button onClick={() => updateMutation.mutate()} className="ml-auto bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" /> {t('common.save')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Expense Breakdown */}
      <Card className="p-6 bg-card">
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-orange-600 dark:text-orange-300" />
          {t('tripFinancialReport.expenseBreakdown')}
        </h3>
        <div className="space-y-3">
          {events.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">{t('tripFinancialReport.noExpenses')}</p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <div>
                  <div className="font-medium text-foreground">{event.title}</div>
                  <div className="text-sm text-muted-foreground">{event.date}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-foreground">${(event.cost || 0).toFixed(2)}</div>
                  {event.quantity > 1 && <div className="text-xs text-muted-foreground">x{event.quantity}</div>}
                </div>
              </div>
            ))
          )}
          <div className="flex justify-between items-center p-3 bg-muted rounded-lg font-bold">
            <span>{t('clientProposalDetails.total')}</span>
            <span>${totalExpenses.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {/* Invoice Summary */}
      <Card className="p-6 bg-card">
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600 dark:text-green-300" />
          {t('tripFinancialReport.invoiceSummary')}
        </h3>
        {tripInvoices.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">{t('tripFinancialReport.noInvoices')}</p>
        ) : (
          <div className="space-y-3">
            {tripInvoices.map((invoice) => (
              <div key={invoice.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <div>
                  <div className="font-medium text-foreground">{invoice.invoice_number}</div>
                  <Badge
                    className={
                      invoice.status === 'paid'
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
                        : invoice.status === 'overdue'
                          ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                          : 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300'
                    }
                  >
                    {t(`invoices.status.${invoice.status}`)}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="font-bold text-foreground">${(invoice.total_amount || 0).toFixed(2)}</div>
                  {invoice.amount_due > 0 && (
                    <div className="text-sm text-orange-600 dark:text-orange-300">
                      {t('tripFinancialReport.due', { amount: `$${invoice.amount_due.toFixed(2)}` })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
