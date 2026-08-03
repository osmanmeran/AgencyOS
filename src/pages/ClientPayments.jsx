import { db } from '@/lib/DbContext';

import { useQuery } from '@tanstack/react-query';
import { useMyClient } from '@/hooks/useMyClient';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SkeletonTable } from '@/components/ui/skeletons';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format, parseISO } from 'date-fns';
import { CreditCard, Landmark, Wallet, Banknote, Receipt, CheckCircle, Clock, XCircle, RotateCcw } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';
import { getCurrencySymbol } from '@/lib/formatters';

const METHOD_ICONS = {
  credit_card: CreditCard,
  bank_transfer: Landmark,
  paypal: Wallet,
  check: Receipt,
  cash: Banknote,
  other: Receipt,
};

const STATUS_STYLES = {
  completed: { icon: CheckCircle, className: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300' },
  pending: { icon: Clock, className: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300' },
  failed: { icon: XCircle, className: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300' },
  refunded: { icon: RotateCcw, className: 'bg-muted text-muted-foreground' },
};

export default function ClientPayments() {
  const { t } = useT();
  const client = useMyClient();

  const { data: payments = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clientPayments', client?.id],
      queryFn: () => db.entities.ClientPayment.filter({ client_id: client.id }),
      enabled: !!client?.id,
    })
  );

  if (!client) {
    return <SkeletonTable />;
  }

  const sortedPayments = [...payments].sort((a, b) => +new Date(b.payment_date) - +new Date(a.payment_date));
  const totalPaid = sortedPayments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">{t('clientPayments.title')}</h1>
          <p className="text-muted-foreground">{t('clientPayments.subtitle')}</p>
        </div>
        {sortedPayments.length > 0 && (
          <div className="text-right">
            <div className="text-sm text-muted-foreground">{t('clientPayments.totalPaid')}</div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {getCurrencySymbol(sortedPayments[0]?.currency || 'USD')}
              {totalPaid.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {sortedPayments.length === 0 ? (
        <Card className="p-12 text-center bg-card">
          <div className="bg-blue-100 dark:bg-blue-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-8 h-8 text-blue-600 dark:text-blue-300" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">{t('clientPayments.noPaymentsTitle')}</h3>
          <p className="text-muted-foreground">{t('clientPayments.noPaymentsBody')}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedPayments.map((payment) => {
            const MethodIcon = METHOD_ICONS[payment.payment_method] || Receipt;
            const statusStyle = STATUS_STYLES[payment.status] || STATUS_STYLES.completed;
            const StatusIcon = statusStyle.icon;
            const cs = getCurrencySymbol(payment.currency || 'USD');

            return (
              <Card key={payment.id} className="p-6 bg-card">
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted text-muted-foreground shrink-0">
                      <MethodIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xl font-bold text-foreground">
                          {cs}
                          {payment.amount?.toFixed(2)}
                        </span>
                        <Badge className={`${statusStyle.className} gap-1`}>
                          <StatusIcon className="w-3 h-3" />
                          {t(`clientPayments.status.${payment.status}`)}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {format(parseISO(payment.payment_date), 'MMMM d, yyyy')} ·{' '}
                        {t(`clientPayments.method.${payment.payment_method}`)}
                      </div>
                      {payment.transaction_id && (
                        <div className="text-xs text-muted-foreground mt-1 font-mono">
                          {t('clientPayments.reference')} {payment.transaction_id}
                        </div>
                      )}
                    </div>
                  </div>
                  {payment.invoice_id && (
                    <Link to={createPageUrl(`ClientInvoiceDetails?id=${payment.invoice_id}`)}>
                      <Badge
                        variant="secondary"
                        className="hover:bg-accent cursor-pointer text-xs whitespace-nowrap gap-1"
                      >
                        <Receipt className="w-3 h-3" />
                        {t('clientPayments.viewInvoice')}
                      </Badge>
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
