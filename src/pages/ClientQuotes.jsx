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

const STATUS_COLORS = {
  submitted: 'bg-blue-100 text-blue-800',
  reviewing: 'bg-amber-100 text-amber-800',
  quoted: 'bg-purple-100 text-purple-800',
  accepted: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
};

export default function ClientQuotes() {
  const { data: quotes = /** @type {any} */ ([]), isLoading } = /** @type {any} */ (useQuery({
    queryKey: ['myQuotes'],
    queryFn: listQuotes,
  }));

  if (isLoading) {
    return <SkeletonTable />;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">My Quote Requests</h1>
          <p className="text-slate-600">Track the quotes you've requested</p>
        </div>
        <Link to={createPageUrl('ClientCatalog')}>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            New Quote Request
          </Button>
        </Link>
      </div>

      {quotes.length === 0 ? (
        <Card className="p-12 text-center bg-white">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No quote requests yet</h3>
          <p className="text-slate-600 mb-6">Browse the catalog to request your first quote</p>
          <Link to={createPageUrl('ClientCatalog')}>
            <Button className="bg-blue-600 hover:bg-blue-700">Browse Catalog</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {quotes.map(quote => (
            <Link key={quote.id} to={createPageUrl(`ClientQuoteDetails?id=${quote.id}`)}>
              <Card className="p-5 bg-white shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900">{quote.title}</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {quote.items?.length || 0} item{quote.items?.length === 1 ? '' : 's'} · Requested {format(parseISO(quote.created_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="font-bold text-green-700 mb-1">${(quote.total || 0).toFixed(2)}</div>
                    <Badge className={STATUS_COLORS[quote.status] || 'bg-gray-100 text-gray-800'}>
                      {quote.status}
                    </Badge>
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
