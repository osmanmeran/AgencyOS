import { db } from '@/lib/DbContext';

import { useQuery } from '@tanstack/react-query';
import { useMyClient } from '@/hooks/useMyClient';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SkeletonTable } from '@/components/ui/skeletons';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format, parseISO, isBefore } from 'date-fns';
import { FileText, Calendar, CheckCircle } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';
import { getCurrencySymbol } from '@/lib/formatters';

export default function ClientInvoices() {
  const { t } = useT();
  const client = useMyClient();

  const { data: invoices = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clientInvoices', client?.id],
      queryFn: () => db.entities.Invoice.filter({ client_id: client.id }),
      enabled: !!client?.id,
    })
  );

  if (!client) {
    return <SkeletonTable />;
  }

  const sortedInvoices = [...invoices].sort((a, b) => +new Date(b.issue_date) - +new Date(a.issue_date));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">{t('clientInvoices.title')}</h1>
        <p className="text-muted-foreground">{t('clientInvoices.subtitle')}</p>
      </div>

      {sortedInvoices.length === 0 ? (
        <Card className="p-12 text-center bg-card">
          <div className="bg-blue-100 dark:bg-blue-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-600 dark:text-blue-300" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">{t('clientInvoices.noInvoicesTitle')}</h3>
          <p className="text-muted-foreground">{t('clientInvoices.noInvoicesBody')}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedInvoices.map((invoice) => {
            const isOverdue = invoice.status !== 'paid' && isBefore(parseISO(invoice.due_date), new Date());
            const isPaid = invoice.status === 'paid';
            const cs = getCurrencySymbol(invoice.currency || 'USD');

            return (
              <Link key={invoice.id} to={createPageUrl(`ClientInvoiceDetails?id=${invoice.id}`)}>
                <Card
                  className={`p-6 bg-card hover:shadow-xl transition-all cursor-pointer ${isOverdue ? 'border-red-200 dark:border-red-800' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-foreground">{invoice.invoice_number}</h3>
                        <Badge
                          className={
                            isPaid
                              ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
                              : isOverdue
                                ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                                : 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300'
                          }
                        >
                          {isPaid
                            ? t('invoices.status.paid')
                            : isOverdue
                              ? t('invoices.status.overdue')
                              : t('common.pending')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {t('clientInvoices.issued', { date: format(parseISO(invoice.issue_date), 'MMM d, yyyy') })}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {t('clientPortal.due', { date: format(parseISO(invoice.due_date), 'MMM d, yyyy') })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-700 dark:text-green-300 mb-1">
                        {cs}
                        {invoice.total_amount.toFixed(2)}
                      </div>
                      {!isPaid && invoice.amount_due > 0 && (
                        <div className="text-sm text-orange-600 dark:text-orange-300">
                          {t('clientInvoices.dueAmount', { amount: `${cs}${invoice.amount_due.toFixed(2)}` })}
                        </div>
                      )}
                      {isPaid && (
                        <div className="flex items-center gap-1 text-green-600 dark:text-green-300 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          {t('clientInvoices.paidInFull')}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
