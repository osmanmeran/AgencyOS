import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, Receipt, Calculator, 
  Save, Percent 
} from 'lucide-react';

export default function TripFinancialReport({ trip, events, invoices }) {
  const queryClient = useQueryClient();
  const [markupPercentage, setMarkupPercentage] = useState(trip.markup_percentage || 0);

  const totalExpenses = events.reduce((sum, e) => sum + (e.cost || 0), 0);
  const markupAmount = totalExpenses * (markupPercentage / 100);
  const finalPrice = totalExpenses + markupAmount;

  const tripInvoices = invoices.filter(i => i.trip_id === trip.id);
//   const totalInvoiced = tripInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
  const totalPaid = tripInvoices.reduce((sum, i) => sum + (i.amount_paid || 0), 0);
//   const totalOutstanding = tripInvoices.reduce((sum, i) => sum + (i.amount_due || 0), 0);

  const profit = totalPaid - totalExpenses;
  const profitMargin = totalPaid > 0 ? (profit / totalPaid * 100) : 0;

  const updateMutation = /** @type {any} */ (useMutation({
    mutationFn: () => db.entities.Trip.update(trip.id, {
      ...trip,
      total_expenses: totalExpenses,
      markup_percentage: markupPercentage,
      final_price: finalPrice
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trip', trip.id] })
  }));

  // Group expenses by supplier
  /* expensesBySupplier removed (unused) */

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-slate-500 to-slate-600 text-white">
          <div className="text-sm opacity-80 mb-1">Total Expenses</div>
          <div className="text-2xl font-bold">${totalExpenses.toFixed(2)}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="text-sm opacity-80 mb-1">Final Price</div>
          <div className="text-2xl font-bold">${finalPrice.toFixed(2)}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="text-sm opacity-80 mb-1">Paid</div>
          <div className="text-2xl font-bold">${totalPaid.toFixed(2)}</div>
        </Card>
        <Card className={`p-4 bg-gradient-to-br ${profit >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-red-500 to-red-600'} text-white`}>
          <div className="text-sm opacity-80 mb-1">Profit</div>
          <div className="text-2xl font-bold">${profit.toFixed(2)}</div>
          <div className="text-xs opacity-80">{profitMargin.toFixed(1)}% margin</div>
        </Card>
      </div>

      {/* Markup Calculator */}
      <Card className="p-6 bg-white">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-600" />
          Price Calculator
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <Label className="text-sm text-slate-600">Total Expenses</Label>
            <div className="text-2xl font-bold text-slate-900">${totalExpenses.toFixed(2)}</div>
          </div>
          <div className="space-y-2">
            <Label>Markup %</Label>
            <div className="flex items-center gap-2">
              <Input 
                type="number" 
                value={markupPercentage}
                onChange={(e) => setMarkupPercentage(parseFloat(e.target.value) || 0)}
                className="w-24"
              />
              <Percent className="w-4 h-4 text-slate-400" />
            </div>
          </div>
          <div>
            <Label className="text-sm text-slate-600">Markup Amount</Label>
            <div className="text-xl font-bold text-blue-600">+${markupAmount.toFixed(2)}</div>
          </div>
          <div className="flex items-center gap-2">
            <div>
              <Label className="text-sm text-slate-600">Final Price</Label>
              <div className="text-2xl font-bold text-green-700">${finalPrice.toFixed(2)}</div>
            </div>
            <Button onClick={() => updateMutation.mutate()} className="ml-auto bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" /> Save
            </Button>
          </div>
        </div>
      </Card>

      {/* Expense Breakdown */}
      <Card className="p-6 bg-white">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-orange-600" />
          Expense Breakdown
        </h3>
        <div className="space-y-3">
          {events.length === 0 ? (
            <p className="text-slate-500 text-center py-4">No expenses recorded</p>
          ) : (
            events.map(event => (
              <div key={event.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <div>
                  <div className="font-medium text-slate-900">{event.title}</div>
                  <div className="text-sm text-slate-600">{event.date}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900">${(event.cost || 0).toFixed(2)}</div>
                  {event.quantity > 1 && (
                    <div className="text-xs text-slate-500">x{event.quantity}</div>
                  )}
                </div>
              </div>
            ))
          )}
          <div className="flex justify-between items-center p-3 bg-slate-200 rounded-lg font-bold">
            <span>Total</span>
            <span>${totalExpenses.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {/* Invoice Summary */}
      <Card className="p-6 bg-white">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          Invoice Summary
        </h3>
        {tripInvoices.length === 0 ? (
          <p className="text-slate-500 text-center py-4">No invoices linked to this trip</p>
        ) : (
          <div className="space-y-3">
            {tripInvoices.map(invoice => (
              <div key={invoice.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <div>
                  <div className="font-medium text-slate-900">{invoice.invoice_number}</div>
                  <Badge className={
                    invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                    invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }>{invoice.status}</Badge>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900">${(invoice.total_amount || 0).toFixed(2)}</div>
                  {invoice.amount_due > 0 && (
                    <div className="text-sm text-orange-600">Due: ${invoice.amount_due.toFixed(2)}</div>
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