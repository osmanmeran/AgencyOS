import { db } from '@/lib/DbContext';

import React, { useMemo } from 'react';
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
import { getCurrencySymbol } from '@/lib/formatters';
import { useT } from '@/lib/i18n/I18nContext';
import { supplierMapsUrl } from '@/lib/supplierMap';
import { assetUrl } from '@/lib/assetUrl';
import { hiddenSupplierIds } from '@/lib/supplierCategories';

const currSymbol = (cur) => getCurrencySymbol(cur);

const STATUS_COLORS = {
  draft: 'bg-muted text-foreground',
  sent: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
  paid: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  overdue: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
  cancelled: 'bg-muted text-foreground',
};

export default function InvoiceDetails() {
  const { t } = useT();
  const STATUS_LABEL_KEYS = {
    draft: t('invoiceDetails.statusDraft'),
    sent: t('common.sent'),
    paid: t('invoiceDetails.statusPaid'),
    overdue: t('invoiceDetails.statusOverdue'),
    cancelled: t('common.cancelled'),
  };
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('id');
  const queryClient = useQueryClient();
  const [paymentModalOpen, setPaymentModalOpen] = React.useState(false);
  const [paymentAmount, setPaymentAmount] = React.useState('');

  const { data: invoice, isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['invoice', invoiceId],
      queryFn: () => db.entities.Invoice.get(invoiceId),
      enabled: !!invoiceId,
    })
  );

  const { data: client } = /** @type {any} */ (
    useQuery({
      queryKey: ['client', invoice?.client_id],
      queryFn: () => db.entities.Client.get(invoice.client_id),
      enabled: !!invoice?.client_id,
    })
  );

  // Contacts that belong to a company are billed to that company, not to
  // themselves — the company's own tax ID / invoice address take over.
  const { data: billingCompany } = /** @type {any} */ (
    useQuery({
      queryKey: ['company', client?.company_id],
      queryFn: () => db.entities.Company.get(client.company_id),
      enabled: !!client?.company_id,
    })
  );

  const { data: settings } = /** @type {any} */ (
    useQuery({
      queryKey: ['appSettings'],
      queryFn: async () => {
        const all = await db.entities.AppSettings.list();
        return all[0] || {};
      },
    })
  );

  const { data: trip } = /** @type {any} */ (
    useQuery({
      queryKey: ['trip', invoice?.trip_id],
      queryFn: () => db.entities.Trip.get(invoice.trip_id),
      enabled: !!invoice?.trip_id,
    })
  );

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['suppliers'],
      queryFn: () => db.entities.Supplier.list(),
    })
  );
  const supplierMap = useMemo(() => Object.fromEntries((suppliers || []).map((s) => [s.id, s])), [suppliers]);

  const { data: supplierCategories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierCategories'],
      queryFn: () => db.entities.SupplierCategory.list(),
    })
  );
  const { data: supplierSubcategories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['allSupplierSubcategories'],
      queryFn: () => db.entities.SupplierSubcategory.list(),
    })
  );
  const hiddenSupplierSet = useMemo(
    () => hiddenSupplierIds(supplierCategories, supplierSubcategories),
    [supplierCategories, supplierSubcategories],
  );

  const invoiceHeader = settings?.invoice_header || {};
  const companyLogoUrl = assetUrl(invoiceHeader.logo_url || settings?.logo_url || '');

  const updateStatusMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ status) => db.entities.Invoice.update(invoiceId, { ...invoice, status }),
      onSuccess: () => {
        showSuccess(t('invoiceDetails.successStatusUpdated'));
        queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      },
      onError: (error) => showError(t('invoiceDetails.errorStatusUpdate'), error.message),
    })
  );

  const { data: currentUser } = /** @type {any} */ (
    useQuery({
      queryKey: ['currentUser'],
      queryFn: () => db.auth.me(),
    })
  );

  const isAdmin = currentUser?.role === 'admin';

  const cancelInvoiceMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () =>
        db.entities.Invoice.update(invoiceId, {
          ...invoice,
          status: 'cancelled',
          cancelled_by: currentUser?.email,
          cancelled_date: new Date().toISOString(),
        }),
      onSuccess: () => {
        showSuccess(t('invoiceDetails.successCancelled'));
        queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      },
      onError: (error) => showError(t('invoiceDetails.errorCancel'), error.message),
    })
  );

  const recordPaymentMutation = /** @type {any} */ (
    useMutation({
      mutationFn: async (/** @type {any} */ amount) => {
        const payment = parseFloat(amount);
        const newAmountPaid = (invoice.amount_paid || 0) + payment;
        const newAmountDue = invoice.total_amount - newAmountPaid;
        const newStatus = newAmountDue <= 0 ? 'paid' : invoice.status;

        await db.entities.Invoice.update(invoiceId, {
          ...invoice,
          amount_paid: newAmountPaid,
          amount_due: newAmountDue,
          status: newStatus,
        });

        await db.entities.ClientPayment.create({
          client_id: invoice.client_id,
          amount: payment,
          currency: invoice.currency || 'USD',
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'bank_transfer',
          status: 'completed',
          notes: `Payment for invoice ${invoice.invoice_number}`,
        });

        if (client) {
          await db.entities.Client.update(client.id, {
            ...client,
            total_paid: (client.total_paid || 0) + payment,
            total_owed: Math.max((client.total_owed || 0) - payment, 0),
          });
        }
      },
      onSuccess: () => {
        showSuccess(t('invoiceDetails.successPaymentRecorded'));
        queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
        queryClient.invalidateQueries({ queryKey: ['client', invoice?.client_id] });
        setPaymentModalOpen(false);
        setPaymentAmount('');
      },
      onError: (error) => showError(t('invoiceDetails.errorPaymentRecord'), error.message),
    })
  );

  if (isLoading) {
    return <SkeletonCard />;
  }

  if (!invoice) {
    return <div className="text-center py-20">{t('invoiceDetails.notFound')}</div>;
  }

  const sc = currSymbol(invoice.currency || 'USD');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-muted print:bg-card">
      {/* Toolbar - hidden when printing */}
      <div className="max-w-[210mm] mx-auto print:hidden pt-4 px-4">
        <div className="flex justify-between items-center mb-4">
          <Link to={createPageUrl('Revenue')}>
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              {t('createInvoice.backToRevenue')}
            </Button>
          </Link>
          <div className="flex flex-wrap gap-2">
            {invoice.status === 'draft' && (
              <Button onClick={() => updateStatusMutation.mutate('sent')} variant="outline">
                <Send className="w-4 h-4 mr-2" />
                {t('invoiceDetails.markAsSent')}
              </Button>
            )}
            {invoice.amount_due > 0 && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <Button onClick={() => setPaymentModalOpen(true)} className="bg-green-600 hover:bg-green-700">
                <DollarSign className="w-4 h-4 mr-2" />
                {t('invoiceDetails.recordPayment')}
              </Button>
            )}
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <PaymentReminderButton invoice={invoice} client={client} settings={settings} />
            )}
            {invoice.status !== 'cancelled' && invoice.status !== 'paid' && isAdmin && (
              <Button onClick={() => cancelInvoiceMutation.mutate()} variant="destructive">
                <XCircle className="w-4 h-4 mr-2" />
                {t('invoiceDetails.cancelInvoice')}
              </Button>
            )}
            <Button onClick={handlePrint} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              {t('invoiceDetails.printPdf')}
            </Button>
          </div>
        </div>
      </div>

      {/* A4 Invoice Document */}
      <div className="max-w-[210mm] mx-auto bg-card shadow-xl print:shadow-none min-h-[297mm] font-['BaselGrotesk',system-ui,sans-serif]">
        <div className="p-[15mm] print:p-[15mm]">
          {/* Logo Header - full width */}
          {companyLogoUrl && (
            <div className="mb-10 flex justify-center">
              <img src={companyLogoUrl} alt="Company Logo" className="max-h-[120px] w-auto object-contain" />
            </div>
          )}

          {/* Company + Invoice Title row */}
          <div className="flex justify-between items-start mb-10">
            <div className="max-w-[60%]">
              <div className="text-lg font-medium text-foreground" style={{ fontWeight: 500 }}>
                {invoiceHeader.company_name || settings?.app_name || ''}
              </div>
              {invoiceHeader.address_line1 && (
                <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{invoiceHeader.address_line1}</div>
              )}
              {invoiceHeader.address_line2 && (
                <div className="text-sm text-muted-foreground leading-relaxed">{invoiceHeader.address_line2}</div>
              )}
              {(invoiceHeader.city || invoiceHeader.postal_code || invoiceHeader.country) && (
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {[invoiceHeader.city, invoiceHeader.postal_code, invoiceHeader.country].filter(Boolean).join(', ')}
                </div>
              )}
              {invoiceHeader.email && <div className="text-sm text-muted-foreground mt-1">{invoiceHeader.email}</div>}
              {invoiceHeader.phone && <div className="text-sm text-muted-foreground">{invoiceHeader.phone}</div>}
              {invoiceHeader.tax_id && (
                <div className="text-sm text-muted-foreground mt-1">
                  {t('invoiceDetails.taxIdPrefix', { taxId: invoiceHeader.tax_id })}
                </div>
              )}
            </div>
            <div className="text-right">
              <h1
                className="text-[28px] font-medium text-foreground leading-none mb-1"
                style={{ fontWeight: 500, letterSpacing: '-0.5px' }}
              >
                {t('invoiceDetails.invoiceTitle')}
              </h1>
              <div className="text-sm text-muted-foreground">{invoice.invoice_number}</div>
              <Badge className={`${STATUS_COLORS[invoice.status]} mt-2 print:hidden`}>
                {STATUS_LABEL_KEYS[invoice.status] || invoice.status}
              </Badge>
            </div>
          </div>

          {/* Bill To / Dates row */}
          <div className="grid grid-cols-2 gap-10 mb-10">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2" style={{ fontWeight: 300 }}>
                {t('invoiceDetails.billToLabel')}
              </div>
              <div className="text-base font-medium text-foreground" style={{ fontWeight: 500 }}>
                {billingCompany?.name || client?.name}
              </div>
              {billingCompany?.tax_id && (
                <div className="text-sm text-muted-foreground mt-1">
                  {t('invoiceDetails.taxIdPrefix', { taxId: billingCompany.tax_id })}
                </div>
              )}
              {billingCompany?.invoice_address ? (
                <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {billingCompany.invoice_address}
                </div>
              ) : (
                <>
                  {client?.address && <div className="text-sm text-muted-foreground mt-1">{client.address}</div>}
                  {client?.city && client?.country && (
                    <div className="text-sm text-muted-foreground">
                      {client.city}, {client.country}
                    </div>
                  )}
                </>
              )}
              {billingCompany && (
                <div className="text-sm text-muted-foreground mt-1">
                  {t('invoiceDetails.attnPrefix', { name: client?.name })}
                </div>
              )}
              {client?.email && <div className="text-sm text-muted-foreground mt-1">{client.email}</div>}
              {client?.phone && <div className="text-sm text-muted-foreground">{client.phone}</div>}
            </div>
            <div className="text-right">
              {trip && (
                <div className="mb-3">
                  <div
                    className="text-xs uppercase tracking-wider text-muted-foreground mb-1"
                    style={{ fontWeight: 300 }}
                  >
                    {t('invoiceDetails.reservationLabel')}
                  </div>
                  <div className="text-sm text-foreground">{trip.reference_number || trip.name}</div>
                </div>
              )}
              <div className="mb-3">
                <div
                  className="text-xs uppercase tracking-wider text-muted-foreground mb-1"
                  style={{ fontWeight: 300 }}
                >
                  {t('invoiceDetails.issueDateLabel')}
                </div>
                <div className="text-sm text-foreground">{format(new Date(invoice.issue_date), 'MMM d, yyyy')}</div>
              </div>
              <div>
                <div
                  className="text-xs uppercase tracking-wider text-muted-foreground mb-1"
                  style={{ fontWeight: 300 }}
                >
                  {t('invoiceDetails.dueDateLabel')}
                </div>
                <div className="text-sm text-foreground">{format(new Date(invoice.due_date), 'MMM d, yyyy')}</div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <table className="w-full mb-8" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b-2 border-border">
                <th
                  className="pb-3 text-left text-xs uppercase tracking-wider text-muted-foreground font-light"
                  style={{ fontWeight: 300 }}
                >
                  {t('invoiceDetails.descriptionColumn')}
                </th>
                <th
                  className="pb-3 text-center text-xs uppercase tracking-wider text-muted-foreground font-light"
                  style={{ fontWeight: 300, width: '80px' }}
                >
                  {t('invoiceDetails.qtyColumn')}
                </th>
                <th
                  className="pb-3 text-right text-xs uppercase tracking-wider text-muted-foreground font-light"
                  style={{ fontWeight: 300, width: '100px' }}
                >
                  {t('invoiceDetails.unitPriceColumn')}
                </th>
                <th
                  className="pb-3 text-right text-xs uppercase tracking-wider text-muted-foreground font-light"
                  style={{ fontWeight: 300, width: '100px' }}
                >
                  {t('invoiceDetails.amountColumn')}
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items?.map((item, index) => (
                <tr key={index} className="border-b border-border">
                  <td className="py-3 text-sm text-foreground">{item.description}</td>
                  <td className="py-3 text-sm text-muted-foreground text-center">{item.quantity}</td>
                  <td className="py-3 text-sm text-muted-foreground text-right">
                    {sc}
                    {item.unit_price.toFixed(2)}
                  </td>
                  <td className="py-3 text-sm font-medium text-foreground text-right" style={{ fontWeight: 500 }}>
                    {sc}
                    {item.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
              {(!invoice.line_items || invoice.line_items.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                    {t('invoiceDetails.noLineItems')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Service details — supplier (hotel) info, map link and tour
              descriptions, sourced from the linked trip's services. */}
          {trip?.services?.length > 0 && (
            <div className="mb-10">
              <h2
                className="text-sm font-medium text-foreground uppercase tracking-wider mb-4"
                style={{ fontWeight: 500 }}
              >
                {t('invoiceDetails.serviceDetailsTitle')}
              </h2>
              <div className="space-y-4">
                {trip.services.map((s, i) => {
                  const sup = s.supplier_id ? supplierMap[s.supplier_id] : null;
                  const supHidden = sup ? hiddenSupplierSet.has(sup.id) : false;
                  const supAddress = sup ? [sup.address, sup.city, sup.area].filter(Boolean).join(', ') : '';
                  const mapUrl = sup ? supplierMapsUrl(sup) : '';
                  return (
                    <div key={i} className="border border-border rounded-lg p-4">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <div className="font-medium text-foreground">{s.name}</div>
                          {s.category && <div className="text-xs text-muted-foreground mt-0.5">{s.category}</div>}
                        </div>
                        {(s.start_date || s.service_date) && (
                          <div className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(s.service_date || s.start_date), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                      {s.description && (
                        <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap leading-relaxed">
                          {s.description}
                        </p>
                      )}
                      {s.location && <div className="text-sm text-muted-foreground mt-1">{s.location}</div>}
                      {sup && !supHidden && (
                        <div className="mt-3 pt-3 border-t border-border text-sm text-muted-foreground space-y-1">
                          <div className="font-medium text-foreground">{sup.name}</div>
                          {supAddress && <div>{supAddress}</div>}
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {sup.website && (
                              <a
                                href={sup.website.startsWith('http') ? sup.website : `https://${sup.website}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 dark:text-blue-300 underline"
                              >
                                {t('invoiceDetails.website')}
                              </a>
                            )}
                            {mapUrl && (
                              <a
                                href={mapUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 dark:text-blue-300 underline"
                              >
                                {t('invoiceDetails.mapLocation')}
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="flex justify-end mb-10">
            <div className="w-[280px] space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{t('invoiceDetails.subtotalLabel')}</span>
                <span>
                  {sc}
                  {invoice.subtotal?.toFixed(2)}
                </span>
              </div>
              {invoice.tax_amount > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{t('invoiceDetails.taxLabel', { rate: invoice.tax_rate })}</span>
                  <span>
                    {sc}
                    {invoice.tax_amount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-lg border-t-2 border-border pt-2" style={{ fontWeight: 500 }}>
                <span>{t('invoiceDetails.totalLabel')}</span>
                <span className="text-foreground">
                  {sc}
                  {invoice.total_amount?.toFixed(2)}
                </span>
              </div>
              {invoice.amount_paid > 0 && (
                <>
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-300">
                    <span>{t('invoiceDetails.amountPaidLabel')}</span>
                    <span>
                      -{sc}
                      {invoice.amount_paid.toFixed(2)}
                    </span>
                  </div>
                  <div
                    className="flex justify-between text-base border-t border-border pt-2 font-medium text-foreground"
                    style={{ fontWeight: 500 }}
                  >
                    <span>{t('invoiceDetails.amountDueLabel')}</span>
                    <span>
                      {sc}
                      {invoice.amount_due?.toFixed(2)}
                    </span>
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
            <div className="border-t border-border pt-6 space-y-4 text-sm text-muted-foreground">
              {invoiceHeader.bank_details && (
                <div>
                  <div
                    className="text-xs uppercase tracking-wider text-muted-foreground mb-1 font-light"
                    style={{ fontWeight: 300 }}
                  >
                    {t('invoiceDetails.bankDetailsLabel')}
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">{invoiceHeader.bank_details}</div>
                </div>
              )}
              {invoice.payment_terms && (
                <div>
                  <div
                    className="text-xs uppercase tracking-wider text-muted-foreground mb-1 font-light"
                    style={{ fontWeight: 300 }}
                  >
                    {t('invoiceDetails.paymentTermsLabel')}
                  </div>
                  <div className="leading-relaxed">{invoice.payment_terms}</div>
                </div>
              )}
              {invoice.notes && (
                <div>
                  <div
                    className="text-xs uppercase tracking-wider text-muted-foreground mb-1 font-light"
                    style={{ fontWeight: 300 }}
                  >
                    {t('invoiceDetails.notesLabel')}
                  </div>
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
            <DialogTitle>{t('invoiceDetails.recordPayment')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">{t('invoiceDetails.amountDueLabel')}</div>
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                {sc}
                {invoice.amount_due.toFixed(2)}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_amount">{t('invoiceDetails.paymentAmountLabel')}</Label>
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
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => recordPaymentMutation.mutate(paymentAmount)}
                className="bg-green-600 hover:bg-green-700"
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {t('invoiceDetails.recordPayment')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
