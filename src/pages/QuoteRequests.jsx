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
import { useT } from '@/lib/i18n/I18nContext';

const STATUS_COLORS = {
  submitted: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
  reviewing: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',
  quoted: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300',
  accepted: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  declined: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
};

const STATUS_FILTERS = ['all', 'submitted', 'reviewing', 'quoted', 'accepted', 'declined'];

export default function QuoteRequests() {
  const { t } = useT();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(/** @type {any} */ (null));
  const [responseStatus, setResponseStatus] = useState('reviewing');
  const [responseNotes, setResponseNotes] = useState('');

  const { data: quotes = /** @type {any} */ ([]), isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['allQuoteRequests'],
      queryFn: () => db.entities.QuoteRequest.list('-created_date'),
    })
  );

  const filtered = statusFilter === 'all' ? quotes : quotes.filter((q) => q.status === statusFilter);

  const openQuote = (quote) => {
    setSelected(quote);
    setResponseStatus(quote.status === 'submitted' ? 'reviewing' : quote.status);
    setResponseNotes(quote.response_notes || '');
  };

  const respondMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () => respondToQuote(selected.id, { status: responseStatus, response_notes: responseNotes }),
      onSuccess: () => {
        showSuccess(t('quoteRequests.quoteUpdatedSuccess'), t('quoteRequests.quoteUpdatedSuccessBody'));
        queryClient.invalidateQueries({ queryKey: ['allQuoteRequests'] });
        setSelected(null);
      },
      onError: (error) => showError(t('quoteRequests.quoteUpdateError'), error.message),
    })
  );

  if (isLoading) {
    return <SkeletonTable />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-1 flex items-center gap-2">
          <ClipboardList className="text-blue-600 dark:text-blue-300 w-7 h-7" />
          {t('quoteRequests.title')}
        </h1>
        <p className="text-muted-foreground text-sm">{t('quoteRequests.subtitle')}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? 'default' : 'outline'}
            className={statusFilter === s ? 'bg-blue-600 hover:bg-blue-700' : ''}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all'
              ? `${t('common.all')} (${quotes.length})`
              : `${t(`quotes.status.${s}`)} (${quotes.filter((q) => q.status === s).length})`}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center bg-card">
          <p className="text-muted-foreground">
            {statusFilter !== 'all'
              ? t('quoteRequests.noRequestsWithStatus', { status: statusFilter })
              : t('quoteRequests.noRequestsYet')}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((quote) => (
            <Card
              key={quote.id}
              className="p-5 bg-card shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 transition-all cursor-pointer"
              onClick={() => openQuote(quote)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{quote.title}</h3>
                    <Badge className={STATUS_COLORS[quote.status] || 'bg-muted text-foreground'}>
                      {t(`quotes.status.${quote.status}`)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {quote.client_name} ·{' '}
                    {t(quote.items?.length === 1 ? 'quoteRequests.itemSingular' : 'quoteRequests.itemPlural', {
                      count: quote.items?.length || 0,
                    })}{' '}
                    · {t('quoteRequests.requested', { date: format(parseISO(quote.created_date), 'MMM d, yyyy') })}
                  </p>
                </div>
                <div className="font-bold text-green-700 dark:text-green-300 ml-4">
                  {formatCurrency(quote.total || 0, quote.currency)}
                </div>
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
                  <Badge className={STATUS_COLORS[selected.status] || 'bg-muted text-foreground'}>
                    {t(`quotes.status.${selected.status}`)}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{selected.client_name}</span> ·{' '}
                  {t('quoteRequests.requested', { date: format(parseISO(selected.created_date), 'MMM d, yyyy') })}
                </div>

                {(selected.destination || selected.start_date || selected.passengers?.length > 0) && (
                  <div className="pb-2 border-b">
                    <QuoteTripInfo quote={selected} />
                  </div>
                )}

                <div className="space-y-2">
                  {(selected.items || []).map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-muted/50"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {item.image_url && (
                          <img src={item.image_url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{item.service_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.supplier_name} · {formatCurrency(item.unit_price, selected.currency)} ×{' '}
                            {item.quantity}
                          </div>
                          <QuoteLineExtras item={item} />
                        </div>
                      </div>
                      <div className="font-semibold text-green-700 dark:text-green-300 text-sm flex-shrink-0">
                        {formatCurrency(item.line_total, selected.currency)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-bold text-foreground">{t('clientProposalDetails.total')}</span>
                  <span className="font-bold text-green-700 dark:text-green-300 text-lg">
                    {formatCurrency(selected.total || 0, selected.currency)}
                  </span>
                </div>

                {selected.notes && (
                  <div className="text-sm">
                    <span className="font-medium text-foreground">{t('quoteRequests.clientNotesLabel')} </span>
                    <span className="text-muted-foreground">{selected.notes}</span>
                  </div>
                )}

                {selected.status === 'accepted' && (
                  <div className="pt-2">
                    {selected.converted_trip_id ? (
                      <Button
                        variant="outline"
                        className="w-full gap-2 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/40"
                        onClick={() => navigate(createPageUrl(`ReservationDetails?id=${selected.converted_trip_id}`))}
                      >
                        <ArrowRightCircle className="w-4 h-4" />
                        {t('quoteRequests.viewReservation')}
                      </Button>
                    ) : (
                      hasPermission('create_trips') && (
                        <Button
                          className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
                          onClick={() => {
                            const quoteId = selected.id;
                            setSelected(null);
                            navigate(createPageUrl(`CreateReservation?fromQuote=${quoteId}`));
                          }}
                        >
                          <ArrowRightCircle className="w-4 h-4" />
                          {t('quoteRequests.convertToReservation')}
                        </Button>
                      )
                    )}
                  </div>
                )}

                <div className="pt-4 border-t space-y-3">
                  <div className="space-y-2">
                    <Label>{t('quoteRequests.setStatus')}</Label>
                    <Select value={responseStatus} onValueChange={setResponseStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reviewing">{t('quotes.status.reviewing')}</SelectItem>
                        <SelectItem value="quoted">{t('quotes.status.quoted')}</SelectItem>
                        <SelectItem value="accepted">{t('quotes.status.accepted')}</SelectItem>
                        <SelectItem value="declined">{t('quotes.status.declined')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('quoteRequests.responseNotesLabel')}</Label>
                    <Textarea
                      value={responseNotes}
                      onChange={(e) => setResponseNotes(e.target.value)}
                      placeholder={t('quoteRequests.responseNotesPlaceholder')}
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setSelected(null)}>
                      {t('common.cancel')}
                    </Button>
                    <Button
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={respondMutation.isPending}
                      onClick={() => respondMutation.mutate()}
                    >
                      {respondMutation.isPending ? t('common.saving') : t('quoteRequests.saveAndNotify')}
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
