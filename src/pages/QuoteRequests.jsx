import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SkeletonTable } from '@/components/ui/skeletons';
import { ClipboardList, ArrowRightCircle } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { format, parseISO } from 'date-fns';
import { respondToQuote } from '@/lib/b2bApi';
import { formatCurrency } from '@/lib/formatters';
import { QuoteTripInfo, QuoteLineExtras } from '@/components/b2b/QuoteRichDetails';
import { createPageUrl } from '../utils';
import { usePermissions } from '@/components/permissions/PermissionContext';

const STATUS_COLORS = {
  submitted: 'bg-blue-100 text-blue-800',
  reviewing: 'bg-amber-100 text-amber-800',
  quoted: 'bg-purple-100 text-purple-800',
  accepted: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
};

const STATUS_FILTERS = ['all', 'submitted', 'reviewing', 'quoted', 'accepted', 'declined'];

export default function QuoteRequests() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(/** @type {any} */ (null));
  const [responseStatus, setResponseStatus] = useState('reviewing');
  const [responseNotes, setResponseNotes] = useState('');

  const { data: quotes = /** @type {any} */ ([]), isLoading } = /** @type {any} */ (useQuery({
    queryKey: ['allQuoteRequests'],
    queryFn: () => db.entities.QuoteRequest.list('-created_date'),
  }));

  const filtered = statusFilter === 'all' ? quotes : quotes.filter(q => q.status === statusFilter);

  const openQuote = (quote) => {
    setSelected(quote);
    setResponseStatus(quote.status === 'submitted' ? 'reviewing' : quote.status);
    setResponseNotes(quote.response_notes || '');
  };

  const respondMutation = /** @type {any} */ (useMutation({
    mutationFn: () => respondToQuote(selected.id, { status: responseStatus, response_notes: responseNotes }),
    onSuccess: () => {
      showSuccess('Quote updated', 'The client has been notified by email.');
      queryClient.invalidateQueries({ queryKey: ['allQuoteRequests'] });
      setSelected(null);
    },
    onError: (error) => showError('Failed to update quote', error.message),
  }));

  if (isLoading) {
    return <SkeletonTable />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-1 flex items-center gap-2">
          <ClipboardList className="text-blue-600 w-7 h-7" />
          Quote Requests
        </h1>
        <p className="text-slate-500 text-sm">Review and respond to B2B quote requests submitted by clients</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? 'default' : 'outline'}
            className={statusFilter === s ? 'bg-blue-600 hover:bg-blue-700' : ''}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? `All (${quotes.length})` : `${s} (${quotes.filter(q => q.status === s).length})`}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center bg-white">
          <p className="text-slate-500">No quote requests {statusFilter !== 'all' ? `with status "${statusFilter}"` : 'yet'}.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(quote => (
            <Card
              key={quote.id}
              className="p-5 bg-white shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
              onClick={() => openQuote(quote)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{quote.title}</h3>
                    <Badge className={STATUS_COLORS[quote.status] || 'bg-gray-100 text-gray-800'}>{quote.status}</Badge>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {quote.client_name} · {quote.items?.length || 0} item{quote.items?.length === 1 ? '' : 's'} · Requested {format(parseISO(quote.created_date), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="font-bold text-green-700 ml-4">{formatCurrency(quote.total || 0, quote.currency)}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.title}
                  <Badge className={STATUS_COLORS[selected.status] || 'bg-gray-100 text-gray-800'}>{selected.status}</Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="text-sm text-slate-600">
                  <span className="font-medium text-slate-900">{selected.client_name}</span> · Requested {format(parseISO(selected.created_date), 'MMM d, yyyy')}
                </div>

                {(selected.destination || selected.start_date || (selected.passengers?.length > 0)) && (
                  <div className="pb-2 border-b">
                    <QuoteTripInfo quote={selected} />
                  </div>
                )}

                <div className="space-y-2">
                  {(selected.items || []).map((item, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                      <div className="flex items-start gap-3 min-w-0">
                        {item.image_url && (
                          <img src={item.image_url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate">{item.service_name}</div>
                          <div className="text-xs text-slate-500">{item.supplier_name} · {formatCurrency(item.unit_price, selected.currency)} × {item.quantity}</div>
                          <QuoteLineExtras item={item} />
                        </div>
                      </div>
                      <div className="font-semibold text-green-700 text-sm flex-shrink-0">{formatCurrency(item.line_total, selected.currency)}</div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-bold text-slate-900">Total</span>
                  <span className="font-bold text-green-700 text-lg">{formatCurrency(selected.total || 0, selected.currency)}</span>
                </div>

                {selected.notes && (
                  <div className="text-sm">
                    <span className="font-medium text-slate-700">Client notes: </span>
                    <span className="text-slate-600">{selected.notes}</span>
                  </div>
                )}

                {selected.status === 'accepted' && (
                  <div className="pt-2">
                    {selected.converted_trip_id ? (
                      <Button
                        variant="outline"
                        className="w-full gap-2 text-green-700 border-green-300 hover:bg-green-50"
                        onClick={() => navigate(createPageUrl(`ReservationDetails?id=${selected.converted_trip_id}`))}
                      >
                        <ArrowRightCircle className="w-4 h-4" />View Reservation
                      </Button>
                    ) : hasPermission('create_trips') && (
                      <Button
                        className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
                        onClick={() => {
                          const quoteId = selected.id;
                          setSelected(null);
                          navigate(createPageUrl(`CreateReservation?fromQuote=${quoteId}`));
                        }}
                      >
                        <ArrowRightCircle className="w-4 h-4" />Convert to Reservation
                      </Button>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t space-y-3">
                  <div className="space-y-2">
                    <Label>Set status</Label>
                    <Select value={responseStatus} onValueChange={setResponseStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reviewing">Reviewing</SelectItem>
                        <SelectItem value="quoted">Quoted</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="declined">Declined</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Response notes (sent to client by email)</Label>
                    <Textarea
                      value={responseNotes}
                      onChange={(e) => setResponseNotes(e.target.value)}
                      placeholder="e.g. Confirmed for your dates, we'll follow up with final booking details."
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
                    <Button
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={respondMutation.isPending}
                      onClick={() => respondMutation.mutate()}
                    >
                      {respondMutation.isPending ? 'Saving...' : 'Save & Notify Client'}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
