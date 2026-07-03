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

const STATUS_COLORS = {
  submitted: 'bg-blue-100 text-blue-800',
  reviewing: 'bg-amber-100 text-amber-800',
  quoted: 'bg-purple-100 text-purple-800',
  accepted: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
};

const STATUS_MESSAGES = {
  submitted: 'Your quote request has been received and is waiting to be reviewed.',
  reviewing: 'Your travel agent is reviewing this request.',
  quoted: 'Your travel agent has responded — they will be in touch to finalize details.',
  accepted: 'This quote has been accepted.',
  declined: 'This quote request was declined. Contact your travel agent for details.',
};

export default function ClientQuoteDetails() {
  const [searchParams] = useSearchParams();
  const quoteId = searchParams.get('id');

  const { data: quote, isLoading } = /** @type {any} */ (useQuery({
    queryKey: ['quote', quoteId],
    queryFn: () => getQuote(quoteId),
    enabled: !!quoteId,
  }));

  if (isLoading) {
    return <SkeletonCard />;
  }

  if (!quote) {
    return <div className="text-center py-20">Quote not found or access denied</div>;
  }

  return (
    <div className="space-y-6">
      <Link to={createPageUrl('ClientQuotes')}>
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Quote Requests
        </Button>
      </Link>

      <Card className="p-8 bg-white shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{quote.title}</h1>
            <p className="text-sm text-slate-500">
              Requested {format(parseISO(quote.created_date), 'MMM d, yyyy')}
            </p>
          </div>
          <Badge className={STATUS_COLORS[quote.status] || 'bg-gray-100 text-gray-800'}>
            {quote.status}
          </Badge>
        </div>

        {STATUS_MESSAGES[quote.status] && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 mb-2">
            {STATUS_MESSAGES[quote.status]}
          </div>
        )}
      </Card>

      {(quote.destination || quote.start_date || (quote.passengers?.length > 0)) && (
        <Card className="p-8 bg-white shadow-lg">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Trip & Travellers</h2>
          <QuoteTripInfo quote={quote} />
        </Card>
      )}

      <Card className="p-8 bg-white shadow-lg">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Requested Services</h2>
        {quote.items && quote.items.length > 0 ? (
          <div className="space-y-4">
            {quote.items.map((item, index) => (
              <div key={index} className="flex items-center gap-4 border-b border-slate-200 pb-4 last:border-0">
                {item.image_url && (
                  <img src={item.image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex justify-between items-start flex-1">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-slate-900">{item.service_name}</h3>
                    <p className="text-slate-500 text-sm mt-1">{item.supplier_name}</p>
                    <QuoteLineExtras item={item} />
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm text-slate-600">
                      {formatCurrency(item.unit_price, quote.currency)} × {item.quantity}
                    </div>
                    <div className="font-bold text-lg text-slate-900">
                      {formatCurrency(item.line_total, quote.currency)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="pt-6 mt-6 border-t-2 border-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold text-slate-900">Total</span>
                <span className="text-4xl font-bold text-green-700">{formatCurrency(quote.total || 0, quote.currency)}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-600">No services in this quote</p>
        )}
      </Card>

      {quote.notes && (
        <Card className="p-8 bg-white shadow-lg">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Notes</h2>
          <p className="text-slate-700 whitespace-pre-wrap">{quote.notes}</p>
        </Card>
      )}
    </div>
  );
}
