import { db } from '@/lib/DbContext';

import { useQuery } from '@tanstack/react-query';
import { useMyClient } from '@/hooks/useMyClient';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeletons';
import { ArrowLeft, Download, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format, parseISO, isBefore } from 'date-fns';

export default function ClientInvoiceDetails() {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('id');
  const client = useMyClient();

  const { data: invoice, isLoading } = /** @type {any} */ (useQuery({
    queryKey: ['clientInvoice', invoiceId],
    queryFn: () => db.entities.Invoice.get(invoiceId),
    enabled: !!invoiceId
  }));

  if (isLoading) {
    return <SkeletonCard />;
  }

  if (!invoice || (client && invoice.client_id !== client.id)) {
    return <div className="text-center py-20">Invoice not found</div>;
  }

  const isOverdue = invoice.status !== 'paid' && isBefore(parseISO(invoice.due_date), new Date());
  const isPaid = invoice.status === 'paid';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex justify-between items-center print:hidden">
        <Link to={createPageUrl('ClientInvoices')}>
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Invoices
          </Button>
        </Link>
        <Button onClick={handlePrint} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Print / PDF
        </Button>
      </div>

      <Card className="p-8 bg-white shadow-lg print:shadow-none">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">INVOICE</h1>
            <div className="text-lg text-slate-600">{invoice.invoice_number}</div>
          </div>
          <Badge className={`text-lg px-4 py-2 print:hidden ${
            isPaid ? 'bg-green-100 text-green-800' :
            isOverdue ? 'bg-red-100 text-red-800' :
            'bg-orange-100 text-orange-800'
          }`}>
            {isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Pending'}
          </Badge>
        </div>

        {!isPaid && (
          <div className={`p-4 rounded-lg mb-6 print:hidden ${isOverdue ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
            <div className="flex items-center gap-2">
              {isOverdue ? (
                <AlertCircle className="w-5 h-5 text-red-600" />
              ) : (
                <Calendar className="w-5 h-5 text-orange-600" />
              )}
              <span className={isOverdue ? 'text-red-800' : 'text-orange-800'}>
                {isOverdue 
                  ? `This invoice is overdue. Please make payment as soon as possible.`
                  : `Payment due by ${format(parseISO(invoice.due_date), 'MMMM d, yyyy')}`
                }
              </span>
            </div>
          </div>
        )}

        {isPaid && (
          <div className="p-4 rounded-lg mb-6 bg-green-50 border border-green-200 print:hidden">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-800">This invoice has been paid in full. Thank you!</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <div className="text-sm text-slate-500 mb-1">Bill To:</div>
            <div className="font-bold text-lg text-slate-900">{client?.name}</div>
            {client?.email && <div className="text-slate-600">{client.email}</div>}
          </div>
          <div className="text-right">
            <div className="mb-4">
              <div className="text-sm text-slate-500">Issue Date:</div>
              <div className="font-semibold text-slate-900">{format(parseISO(invoice.issue_date), 'MMM d, yyyy')}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Due Date:</div>
              <div className="font-semibold text-slate-900">{format(parseISO(invoice.due_date), 'MMM d, yyyy')}</div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-8">
          <table className="w-full">
            <thead className="border-b-2 border-slate-300">
              <tr className="text-left">
                <th className="pb-3 text-slate-600">Description</th>
                <th className="pb-3 text-slate-600 text-center">Qty</th>
                <th className="pb-3 text-slate-600 text-right">Price</th>
                <th className="pb-3 text-slate-600 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items?.map((item, index) => (
                <tr key={index} className="border-b border-slate-200">
                  <td className="py-4">{item.description}</td>
                  <td className="py-4 text-center">{item.quantity}</td>
                  <td className="py-4 text-right">${item.unit_price.toFixed(2)}</td>
                  <td className="py-4 text-right font-semibold">${item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-80 space-y-3">
            <div className="flex justify-between text-lg">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-semibold">${invoice.subtotal?.toFixed(2)}</span>
            </div>
            {invoice.tax_amount > 0 && (
              <div className="flex justify-between text-lg">
                <span className="text-slate-600">Tax ({invoice.tax_rate}%):</span>
                <span className="font-semibold">${invoice.tax_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-2xl font-bold border-t-2 pt-3">
              <span>Total:</span>
              <span className="text-green-700">${invoice.total_amount.toFixed(2)}</span>
            </div>
            {invoice.amount_paid > 0 && (
              <>
                <div className="flex justify-between text-lg text-green-600">
                  <span>Amount Paid:</span>
                  <span className="font-semibold">-${invoice.amount_paid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold border-t pt-3">
                  <span>Amount Due:</span>
                  <span className={invoice.amount_due > 0 ? 'text-orange-700' : 'text-green-700'}>
                    ${invoice.amount_due?.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {invoice.payment_terms && (
          <div className="mt-8 pt-8 border-t border-slate-200">
            <div className="text-sm font-semibold text-slate-700 mb-1">Payment Terms:</div>
            <div className="text-slate-600">{invoice.payment_terms}</div>
          </div>
        )}
      </Card>
    </div>
  );
}