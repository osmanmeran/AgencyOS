import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonTable } from '@/components/ui/skeletons';
import { FileText, Plus } from 'lucide-react';
import { createPageUrl } from '../utils';
import { format, parseISO } from 'date-fns';
import { listQuotes } from '@/lib/b2bApi';
import { useActAsClientId } from '@/lib/actAsClient';
import { formatCurrency } from '@/lib/formatters';

const STATUS_COLORS = {
  submitted: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
  reviewing: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',
  quoted: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300',
  accepted: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  declined: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
};

export default function ClientQuotes() {
  const actAsClientId = useActAsClientId();
  const { data: quotes = /** @type {any} */ ([]), isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['myQuotes', actAsClientId],
      queryFn: listQuotes,
    })
  );

  if (isLoading) {
    return <SkeletonTable />;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">My Quote Requests</h1>
          <p className="text-muted-foreground">Track the quotes you've requested</p>
        </div>
        <Link to={createPageUrl('ClientQuoteBuilder')}>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            New Quote Request
          </Button>
        </Link>
      </div>

      {quotes.length === 0 ? (
        <Card className="p-12 text-center bg-card">
          <div className="bg-blue-100 dark:bg-blue-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-600 dark:text-blue-300" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">No quote requests yet</h3>
          <p className="text-muted-foreground mb-6">Build a trip from our services to request your first quote</p>
          <Link to={createPageUrl('ClientQuoteBuilder')}>
            <Button className="bg-blue-600 hover:bg-blue-700">Request a Quote</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {quotes.map((quote) => (
            <Link key={quote.id} to={createPageUrl(`ClientQuoteDetails?id=${quote.id}`)}>
              <Card className="p-5 bg-card shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 transition-all cursor-pointer">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{quote.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {quote.items?.length || 0} item{quote.items?.length === 1 ? '' : 's'} · Requested{' '}
                      {format(parseISO(quote.created_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="font-bold text-green-700 dark:text-green-300 mb-1">
                      {formatCurrency(quote.total || 0, quote.currency)}
                    </div>
                    <Badge className={STATUS_COLORS[quote.status] || 'bg-muted text-foreground'}>{quote.status}</Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
