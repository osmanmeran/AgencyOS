import { db } from '@/lib/DbContext';

import { useMemo } from 'react';
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
import { useT } from '@/lib/i18n/I18nContext';
import { getCurrencySymbol } from '@/lib/formatters';

export default function ClientInvoiceDetails() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('id');
  const client = useMyClient();

  const { data: invoice, isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['clientInvoice', invoiceId],
      queryFn: () => db.entities.Invoice.get(invoiceId),
      enabled: !!invoiceId,
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

  const { data: trip } = /** @type {any} */ (
    useQuery({
      queryKey: ['clientInvoiceTrip', invoice?.trip_id],
      queryFn: () => db.entities.Trip.get(invoice.trip_id),
      enabled: !!invoice?.trip_id,
    })
  );

  const contactPassenger = useMemo(() => {
    const pax = trip?.passengers || [];
    return pax.find((p) => p.is_contact) || pax[0] || null;
  }, [trip]);

  const tripDateRange = useMemo(() => {
    if (!trip?.start_date && !trip?.end_date) return '';
    return [trip?.start_date, trip?.end_date]
      .filter(Boolean)
      .map((d) => format(parseISO(d), 'MMM d, yyyy'))
      .join(' – ');
  }, [trip]);

  if (isLoading) {
    return <SkeletonCard />;
  }

  if (!invoice || (client && invoice.client_id !== client.id)) {
    return <div className="text-center py-20">{t('clientInvoiceDetails.notFound')}</div>;
  }

  const isOverdue = invoice.status !== 'paid' && isBefore(parseISO(invoice.due_date), new Date());
  const isPaid = invoice.status === 'paid';
  const cs = getCurrencySymbol(invoice.currency || 'USD');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex justify-between items-center print:hidden">
        <Link to={createPageUrl('ClientInvoices')}>
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('clientInvoiceDetails.backToInvoices')}
          </Button>
        </Link>
        <Button onClick={handlePrint} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          {t('clientInvoiceDetails.printPdf')}
        </Button>
      </div>

      <Card className="p-8 print:p-4 bg-card shadow-lg print:shadow-none">
        <div className="flex justify-between items-start mb-8 print:mb-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">{t('clientInvoiceDetails.invoiceLabel')}</h1>
            <div className="text-lg text-muted-foreground">{invoice.invoice_number}</div>
          </div>
          <Badge
            className={`text-lg px-4 py-2 print:hidden ${
              isPaid
                ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
                : isOverdue
                  ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                  : 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300'
            }`}
          >
            {isPaid ? t('invoices.status.paid') : isOverdue ? t('invoices.status.overdue') : t('common.pending')}
          </Badge>
        </div>

        {!isPaid && (
          <div
            className={`p-4 rounded-lg mb-6 print:hidden ${isOverdue ? 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800' : 'bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800'}`}
          >
            <div className="flex items-center gap-2">
              {isOverdue ? (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-300" />
              ) : (
                <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-300" />
              )}
              <span className={isOverdue ? 'text-red-800 dark:text-red-300' : 'text-orange-800 dark:text-orange-300'}>
                {isOverdue
                  ? t('clientInvoiceDetails.overdueMessage')
                  : t('clientInvoiceDetails.paymentDueBy', {
                      date: format(parseISO(invoice.due_date), 'MMMM d, yyyy'),
                    })}
              </span>
            </div>
          </div>
        )}

        {isPaid && (
          <div className="p-4 rounded-lg mb-6 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 print:hidden">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-300" />
              <span className="text-green-800 dark:text-green-300">{t('clientInvoiceDetails.paidThankYou')}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:gap-4 mb-8 print:mb-4">
          <div>
            <div className="text-sm text-muted-foreground mb-1">{t('clientInvoiceDetails.billTo')}</div>
            <div className="font-bold text-lg text-foreground">{billingCompany?.name || client?.name}</div>
            {billingCompany?.tax_id && (
              <div className="text-muted-foreground mt-1">
                {t('clientInvoiceDetails.taxIdLabel')} {billingCompany.tax_id}
              </div>
            )}
            {billingCompany?.invoice_address && (
              <div className="text-muted-foreground mt-1 whitespace-pre-wrap">{billingCompany.invoice_address}</div>
            )}
            {billingCompany && (
              <div className="text-muted-foreground mt-1">
                {t('clientInvoiceDetails.attn')} {client?.name}
              </div>
            )}
            {client?.email && <div className="text-muted-foreground">{client.email}</div>}
          </div>
          <div className="text-right">
            {trip && (
              <div className="mb-4">
                {trip.destination && <div className="font-semibold text-foreground">{trip.destination}</div>}
                {tripDateRange && <div className="text-muted-foreground">{tripDateRange}</div>}
                {contactPassenger?.name && (
                  <div className="text-muted-foreground">
                    {t('clientInvoiceDetails.passengerLabel', { name: contactPassenger.name })}
                  </div>
                )}
              </div>
            )}
            <div className="mb-4">
              <div className="text-sm text-muted-foreground">{t('clientInvoiceDetails.issueDate')}</div>
              <div className="font-semibold text-foreground">{format(parseISO(invoice.issue_date), 'MMM d, yyyy')}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t('clientInvoiceDetails.dueDate')}</div>
              <div className="font-semibold text-foreground">{format(parseISO(invoice.due_date), 'MMM d, yyyy')}</div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-8 print:mb-4">
          <table className="w-full">
            <thead className="border-b-2 border-border">
              <tr className="text-left">
                <th className="pb-3 print:pb-1.5 text-muted-foreground">{t('clientInvoiceDetails.descriptionCol')}</th>
                <th className="pb-3 print:pb-1.5 text-muted-foreground text-center">
                  {t('clientInvoiceDetails.qtyCol')}
                </th>
                <th className="pb-3 print:pb-1.5 text-muted-foreground text-right">
                  {t('clientInvoiceDetails.priceCol')}
                </th>
                <th className="pb-3 print:pb-1.5 text-muted-foreground text-right">
                  {t('clientInvoiceDetails.amountCol')}
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items?.map((item, index) => (
                <tr key={index} className="border-b border-border print:break-inside-avoid">
                  <td className="py-4 print:py-2">{item.description}</td>
                  <td className="py-4 print:py-2 text-center">{item.quantity}</td>
                  <td className="py-4 print:py-2 text-right">
                    {cs}
                    {item.unit_price.toFixed(2)}
                  </td>
                  <td className="py-4 print:py-2 text-right font-semibold">
                    {cs}
                    {item.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end print:break-inside-avoid">
          <div className="w-80 space-y-3 print:space-y-1.5">
            <div className="flex justify-between text-lg">
              <span className="text-muted-foreground">{t('clientInvoiceDetails.subtotal')}</span>
              <span className="font-semibold">
                {cs}
                {invoice.subtotal?.toFixed(2)}
              </span>
            </div>
            {invoice.tax_amount > 0 && (
              <div className="flex justify-between text-lg">
                <span className="text-muted-foreground">
                  {t('clientInvoiceDetails.taxLabel', { rate: invoice.tax_rate })}
                </span>
                <span className="font-semibold">
                  {cs}
                  {invoice.tax_amount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-2xl font-bold border-t-2 pt-3">
              <span>{t('clientInvoiceDetails.total')}</span>
              <span className="text-green-700 dark:text-green-300">
                {cs}
                {invoice.total_amount.toFixed(2)}
              </span>
            </div>
            {invoice.amount_paid > 0 && (
              <>
                <div className="flex justify-between text-lg text-green-600 dark:text-green-300">
                  <span>{t('clientInvoiceDetails.amountPaid')}</span>
                  <span className="font-semibold">
                    -{cs}
                    {invoice.amount_paid.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xl font-bold border-t pt-3">
                  <span>{t('clientInvoiceDetails.amountDue')}</span>
                  <span
                    className={
                      invoice.amount_due > 0
                        ? 'text-orange-700 dark:text-orange-300'
                        : 'text-green-700 dark:text-green-300'
                    }
                  >
                    {cs}
                    {invoice.amount_due?.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {invoice.payment_terms && (
          <div className="mt-8 print:mt-4 pt-8 print:pt-4 border-t border-border">
            <div className="text-sm font-semibold text-foreground mb-1">{t('clientInvoiceDetails.paymentTerms')}</div>
            <div className="text-muted-foreground">{invoice.payment_terms}</div>
          </div>
        )}
      </Card>
    </div>
  );
}
