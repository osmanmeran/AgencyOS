import { db } from '@/lib/DbContext';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SkeletonCard } from '@/components/ui/skeletons';
import { ArrowLeft, Download, Send, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import PaymentLinkPanel from '../components/invoices/PaymentLinkPanel';
import PaymentReminderButton from '../components/invoices/PaymentReminderButton';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format } from 'date-fns';

const currSymbol = (cur) => ({ USD: '$', EUR: '€', GBP: '£', TRY: '₺', AED: 'د.إ', SAR: '﷼', EGP: 'E£', MAD: 'MAD', JPY: '¥', CHF: 'CHF', CAD: 'CA$', AUD: 'A$' }[cur] || (cur || '$'));

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-800'
};

export default function InvoiceDetails() {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('id');
  const queryClient = useQueryClient();
  const [paymentModalOpen, setPaymentModalOpen] = React.useState(false);
  const [paymentAmount, setPaymentAmount] = React.useState('');

  const { data: invoice, isLoading } = /** @type {any} */ (useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => db.entities.Invoice.get(invoiceId),
    enabled: !!invoiceId
  }));

  const { data: client } = /** @type {any} */ (useQuery({
    queryKey: ['client', invoice?.client_id],
    queryFn: () => db.entities.Client.get(invoice.client_id),
    enabled: !!invoice?.client_id
  }));

  // Contacts that belong to a company are billed to that company, not to
  // themselves — the company's own tax ID / invoice address take over.
  const { data: billingCompany } = /** @type {any} */ (useQuery({
    queryKey: ['company', client?.company_id],
    queryFn: () => db.entities.Company.get(client.company_id),
    enabled: !!client?.company_id
  }));

  const { data: settings } = /** @type {any} */ (useQuery({
    queryKey: ['appSettings'],
    queryFn: async () => {
      const all = await db.entities.AppSettings.list();
      return all[0] || {};
    }
  }));

  const { data: trip } = /** @type {any} */ (useQuery({
    queryKey: ['trip', invoice?.trip_id],
    queryFn: () => db.entities.Trip.get(invoice.trip_id),
    enabled: !!invoice?.trip_id
  }));

  const invoiceHeader = settings?.invoice_header || {};
  const companyLogoUrl = invoiceHeader.logo_url || settings?.logo_url || '';

  const updateStatusMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ status) => db.entities.Invoice.update(invoiceId, { ...invoice, status }),
    onSuccess: () => {
      showSuccess('Invoice status updated');
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
    onError: (error) => showError('Failed to update invoice status', error.message)
  }));

  const { data: currentUser } = /** @type {any} */ (useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me()
  }));

  const isAdmin = currentUser?.role === 'admin';

  const cancelInvoiceMutation = /** @type {any} */ (useMutation({
    mutationFn: () => db.entities.Invoice.update(invoiceId, { 
      ...invoice, 
      status: 'cancelled',
      cancelled_by: currentUser?.email,
      cancelled_date: new Date().toISOString()
    }),
    onSuccess: () => {
      showSuccess('Invoice cancelled');
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
    onError: (error) => showError('Failed to cancel invoice', error.message)
  }));

  const recordPaymentMutation = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ amount) => {
      const payment = parseFloat(amount);
      const newAmountPaid = (invoice.amount_paid || 0) + payment;
      const newAmountDue = invoice.total_amount - newAmountPaid;
      const newStatus = newAmountDue <= 0 ? 'paid' : invoice.status;

      await db.entities.Invoice.update(invoiceId, {
        ...invoice,
        amount_paid: newAmountPaid,
        amount_due: newAmountDue,
        status: newStatus
      });

      await db.entities.ClientPayment.create({
        client_id: invoice.client_id,
        amount: payment,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'bank_transfer',
        status: 'completed',
        notes: `Payment for invoice ${invoice.invoice_number}`
      });

      if (client) {
        await db.entities.Client.update(client.id, {
          ...client,
          total_paid: (client.total_paid || 0) + payment,
          total_owed: Math.max((client.total_owed || 0) - payment, 0)
        });
      }
    },
    onSuccess: () => {
      showSuccess('Payment recorded');
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['client', invoice?.client_id] });
      setPaymentModalOpen(false);
      setPaymentAmount('');
    },
    onError: (error) => showError('Failed to record payment', error.message)
  }));

  if (isLoading) {
    return <SkeletonCard />;
  }

  if (!invoice) {
    return <div className="text-center py-20">Invoice not found</div>;
  }

  const sc = currSymbol(invoice.currency || 'USD');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Toolbar - hidden when printing */}
      <div className="max-w-[210mm] mx-auto print:hidden pt-4 px-4">
        <div className="flex justify-between items-center mb-4">
          <Link to={createPageUrl('Revenue')}>
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Revenue
            </Button>
          </Link>
          <div className="flex flex-wrap gap-2">
            {invoice.status === 'draft' && (
              <Button onClick={() => updateStatusMutation.mutate('sent')} variant="outline">
                <Send className="w-4 h-4 mr-2" />
                Mark as Sent
              </Button>
            )}
            {invoice.amount_due > 0 && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <Button onClick={() => setPaymentModalOpen(true)} className="bg-green-600 hover:bg-green-700">
                <DollarSign className="w-4 h-4 mr-2" />
                Record Payment
              </Button>
            )}
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <PaymentReminderButton invoice={invoice} client={client} settings={settings} />
            )}
            {invoice.status !== 'cancelled' && invoice.status !== 'paid' && isAdmin && (
              <Button onClick={() => cancelInvoiceMutation.mutate()} variant="destructive">
                <XCircle className="w-4 h-4 mr-2" />
                Cancel Invoice
              </Button>
            )}
            <Button onClick={handlePrint} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Print / PDF
            </Button>
          </div>
        </div>
      </div>

      {/* A4 Invoice Document */}
      <div className="max-w-[210mm] mx-auto bg-white shadow-xl print:shadow-none min-h-[297mm] font-['BaselGrotesk',system-ui,sans-serif]">
        <div className="p-[15mm] print:p-[15mm]">
          {/* Logo Header - full width */}
          {companyLogoUrl && (
            <div className="mb-10 flex justify-center">
              <img src={companyLogoUrl} alt="Company Logo" className="max-h-[60px] object-contain" />
            </div>
          )}

          {/* Company + Invoice Title row */}
          <div className="flex justify-between items-start mb-10">
            <div className="max-w-[60%]">
              <div className="text-lg font-medium text-slate-800" style={{ fontWeight: 500 }}>
                {invoiceHeader.company_name || settings?.app_name || ''}
              </div>
              {invoiceHeader.address_line1 && <div className="text-sm text-slate-500 mt-1 leading-relaxed">{invoiceHeader.address_line1}</div>}
              {invoiceHeader.address_line2 && <div className="text-sm text-slate-500 leading-relaxed">{invoiceHeader.address_line2}</div>}
              {(invoiceHeader.city || invoiceHeader.postal_code || invoiceHeader.country) && (
                <div className="text-sm text-slate-500 leading-relaxed">
                  {[invoiceHeader.city, invoiceHeader.postal_code, invoiceHeader.country].filter(Boolean).join(', ')}
                </div>
              )}
              {invoiceHeader.email && <div className="text-sm text-slate-500 mt-1">{invoiceHeader.email}</div>}
              {invoiceHeader.phone && <div className="text-sm text-slate-500">{invoiceHeader.phone}</div>}
              {invoiceHeader.tax_id && <div className="text-sm text-slate-500 mt-1">Tax ID: {invoiceHeader.tax_id}</div>}
            </div>
            <div className="text-right">
              <h1 className="text-[28px] font-medium text-slate-900 leading-none mb-1" style={{ fontWeight: 500, letterSpacing: '-0.5px' }}>INVOICE</h1>
              <div className="text-sm text-slate-500">{invoice.invoice_number}</div>
              <Badge className={`${STATUS_COLORS[invoice.status]} mt-2 print:hidden`}>
                {invoice.status}
              </Badge>
            </div>
          </div>

          {/* Bill To / Dates row */}
          <div className="grid grid-cols-2 gap-10 mb-10">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400 mb-2" style={{ fontWeight: 300 }}>Bill To</div>
              <div className="text-base font-medium text-slate-900" style={{ fontWeight: 500 }}>{billingCompany?.name || client?.name}</div>
              {billingCompany?.tax_id && <div className="text-sm text-slate-600 mt-1">Tax ID: {billingCompany.tax_id}</div>}
              {billingCompany?.invoice_address ? (
                <div className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{billingCompany.invoice_address}</div>
              ) : (
                <>
                  {client?.address && <div className="text-sm text-slate-600 mt-1">{client.address}</div>}
                  {client?.city && client?.country && (
                    <div className="text-sm text-slate-600">{client.city}, {client.country}</div>
                  )}
                </>
              )}
              {billingCompany && <div className="text-sm text-slate-600 mt-1">Attn: {client?.name}</div>}
              {client?.email && <div className="text-sm text-slate-600 mt-1">{client.email}</div>}
              {client?.phone && <div className="text-sm text-slate-600">{client.phone}</div>}
            </div>
            <div className="text-right">
              {trip && (
                <div className="mb-3">
                  <div className="text-xs uppercase tracking-wider text-slate-400 mb-1" style={{ fontWeight: 300 }}>Reservation</div>
                  <div className="text-sm text-slate-700">{trip.reference_number || trip.name}</div>
                </div>
              )}
              <div className="mb-3">
                <div className="text-xs uppercase tracking-wider text-slate-400 mb-1" style={{ fontWeight: 300 }}>Issue Date</div>
                <div className="text-sm text-slate-700">{format(new Date(invoice.issue_date), 'MMM d, yyyy')}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400 mb-1" style={{ fontWeight: 300 }}>Due Date</div>
                <div className="text-sm text-slate-700">{format(new Date(invoice.due_date), 'MMM d, yyyy')}</div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <table className="w-full mb-8" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b-2 border-slate-300">
                <th className="pb-3 text-left text-xs uppercase tracking-wider text-slate-400 font-light" style={{ fontWeight: 300 }}>Description</th>
                <th className="pb-3 text-center text-xs uppercase tracking-wider text-slate-400 font-light" style={{ fontWeight: 300, width: '80px' }}>Qty</th>
                <th className="pb-3 text-right text-xs uppercase tracking-wider text-slate-400 font-light" style={{ fontWeight: 300, width: '100px' }}>Unit Price</th>
                <th className="pb-3 text-right text-xs uppercase tracking-wider text-slate-400 font-light" style={{ fontWeight: 300, width: '100px' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items?.map((item, index) => (
                <tr key={index} className="border-b border-slate-100">
                  <td className="py-3 text-sm text-slate-800">{item.description}</td>
                  <td className="py-3 text-sm text-slate-600 text-center">{item.quantity}</td>
                  <td className="py-3 text-sm text-slate-600 text-right">{sc}{item.unit_price.toFixed(2)}</td>
                  <td className="py-3 text-sm font-medium text-slate-900 text-right" style={{ fontWeight: 500 }}>{sc}{item.amount.toFixed(2)}</td>
                </tr>
              ))}
              {(!invoice.line_items || invoice.line_items.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-slate-400">No line items</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-10">
            <div className="w-[280px] space-y-2">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span>{sc}{invoice.subtotal?.toFixed(2)}</span>
              </div>
              {invoice.tax_amount > 0 && (
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Tax ({invoice.tax_rate}%)</span>
                  <span>{sc}{invoice.tax_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg border-t-2 border-slate-300 pt-2" style={{ fontWeight: 500 }}>
                <span>Total</span>
                <span className="text-slate-900">{sc}{invoice.total_amount?.toFixed(2)}</span>
              </div>
              {invoice.amount_paid > 0 && (
                <>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Amount Paid</span>
                    <span>-{sc}{invoice.amount_paid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base border-t border-slate-200 pt-2 font-medium text-slate-900" style={{ fontWeight: 500 }}>
                    <span>Amount Due</span>
                    <span>{sc}{invoice.amount_due?.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Payment Link (screen only) */}
          <div className="print:hidden mb-8">
            <PaymentLinkPanel invoice={invoice} client={client} />
          </div>

          {/* Footer - Bank Details, Payment Terms, Notes */}
          {(invoiceHeader.bank_details || invoice.payment_terms || invoice.notes) && (
            <div className="border-t border-slate-200 pt-6 space-y-4 text-sm text-slate-600">
              {invoiceHeader.bank_details && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-400 mb-1 font-light" style={{ fontWeight: 300 }}>Bank Details</div>
                  <div className="whitespace-pre-wrap leading-relaxed">{invoiceHeader.bank_details}</div>
                </div>
              )}
              {invoice.payment_terms && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-400 mb-1 font-light" style={{ fontWeight: 300 }}>Payment Terms</div>
                  <div className="leading-relaxed">{invoice.payment_terms}</div>
                </div>
              )}
              {invoice.notes && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-400 mb-1 font-light" style={{ fontWeight: 300 }}>Notes</div>
                  <div className="whitespace-pre-wrap leading-relaxed">{invoice.notes}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="text-sm text-slate-600 mb-1">Amount Due</div>
              <div className="text-2xl font-bold text-orange-700">{sc}{invoice.amount_due.toFixed(2)}</div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="payment_amount">Payment Amount *</Label>
              <Input
                id="payment_amount"
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setPaymentModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => recordPaymentMutation.mutate(paymentAmount)}
                className="bg-green-600 hover:bg-green-700"
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Record Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}