import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeletons';
import { ArrowLeft } from 'lucide-react';
import { createPageUrl } from '../utils';
import { format, parseISO } from 'date-fns';
import { getQuote } from '@/lib/b2bApi';
import { formatCurrency } from '@/lib/formatters';
import { QuoteTripInfo, QuoteLineExtras } from '@/components/b2b/QuoteRichDetails';
import { useT } from '@/lib/i18n/I18nContext';

const STATUS_COLORS = {
  submitted: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
  reviewing: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',
  quoted: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300',
  accepted: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  declined: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
};

export default function ClientQuoteDetails() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const quoteId = searchParams.get('id');

  const { data: quote, isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['quote', quoteId],
      queryFn: () => getQuote(quoteId),
      enabled: !!quoteId,
    })
  );

  if (isLoading) {
    return <SkeletonCard />;
  }

  if (!quote) {
    return <div className="text-center py-20">{t('clientQuoteDetails.notFoundOrDenied')}</div>;
  }

  return (
    <div className="space-y-6">
      <Link to={createPageUrl('ClientQuotes')}>
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          {t('clientQuoteDetails.backToQuotes')}
        </Button>
      </Link>

      <Card className="p-8 bg-card shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{quote.title}</h1>
            <p className="text-sm text-muted-foreground">
              {t('clientQuotes.requested', { date: format(parseISO(quote.created_date), 'MMM d, yyyy') })}
            </p>
          </div>
          <Badge className={STATUS_COLORS[quote.status] || 'bg-muted text-foreground'}>
            {t(`quotes.status.${quote.status}`)}
          </Badge>
        </div>

        {quote.status && STATUS_COLORS[quote.status] && (
          <div className="p-3 bg-muted border border-border rounded-lg text-sm text-muted-foreground mb-2">
            {t(`quotes.statusMessage.${quote.status}`)}
          </div>
        )}
      </Card>

      {(quote.destination || quote.start_date || quote.passengers?.length > 0) && (
        <Card className="p-8 bg-card shadow-lg">
          <h2 className="text-xl font-bold text-foreground mb-4">{t('clientQuoteDetails.tripAndTravellers')}</h2>
          <QuoteTripInfo quote={quote} />
        </Card>
      )}

      <Card className="p-8 bg-card shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6">{t('clientQuoteDetails.requestedServices')}</h2>
        {quote.items && quote.items.length > 0 ? (
          <div className="space-y-4">
            {quote.items.map((item, index) => (
              <div key={index} className="flex items-center gap-4 border-b border-border pb-4 last:border-0">
                {item.image_url && (
                  <img src={item.image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex justify-between items-start flex-1">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-foreground">{item.service_name}</h3>
                    <QuoteLineExtras item={item} />
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(item.unit_price, quote.currency)} × {item.quantity}
                    </div>
                    <div className="font-bold text-lg text-foreground">
                      {formatCurrency(item.line_total, quote.currency)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="pt-6 mt-6 border-t-2 border-border">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold text-foreground">{t('clientProposalDetails.total')}</span>
                <span className="text-4xl font-bold text-green-700 dark:text-green-300">
                  {formatCurrency(quote.total || 0, quote.currency)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">{t('clientQuoteDetails.noServicesInQuote')}</p>
        )}
      </Card>

      {quote.notes && (
        <Card className="p-8 bg-card shadow-lg">
          <h2 className="text-xl font-bold text-foreground mb-4">{t('common.notes')}</h2>
          <p className="text-foreground whitespace-pre-wrap">{quote.notes}</p>
        </Card>
      )}
    </div>
  );
}
