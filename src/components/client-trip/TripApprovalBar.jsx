import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, MessageSquare, Send, Clock } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

export default function TripApprovalBar({ trip, clientId }) {
  const { t } = useT();
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [isSending, setIsSending] = useState(false);
  const queryClient = useQueryClient();

  const approveMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ status) => db.entities.Trip.update(trip.id, { proposal_status: status }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trip', trip.id] }),
    })
  );

  const sendComment = async () => {
    if (!comment.trim()) return;
    setIsSending(true);
    await db.entities.Message.create({
      client_id: clientId,
      sender_type: 'client',
      sender_email: '',
      content: comment,
      reference_type: 'trip',
      reference_id: trip.id,
      subject: `Comment on trip: ${trip.name}`,
    });
    setComment('');
    setShowComment(false);
    setIsSending(false);
    queryClient.invalidateQueries({ queryKey: ['messages', trip.id] });
  };

  const status = trip.proposal_status;

  const statusDisplay = {
    pending: {
      icon: Clock,
      text: t('tripApprovalBar.awaitingConfirmation'),
      color:
        'text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    },
    sent: {
      icon: Clock,
      text: t('tripApprovalBar.awaitingConfirmation'),
      color:
        'text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    },
    confirmed: {
      icon: CheckCircle2,
      text: t('tripApprovalBar.confirmedItinerary'),
      color:
        'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800',
    },
    rejected: {
      icon: XCircle,
      text: t('tripApprovalBar.requestedChanges'),
      color: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800',
    },
  };

  const current = statusDisplay[status] || statusDisplay.pending;
  const Icon = current.icon;

  return (
    <div className={`rounded-xl border p-4 ${current.color}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium text-sm">{current.text}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {status !== 'confirmed' && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              onClick={() => approveMutation.mutate('confirmed')}
              disabled={approveMutation.isPending}
            >
              <CheckCircle2 className="w-4 h-4" />
              {t('tripApprovalBar.approveItinerary')}
            </Button>
          )}
          {status !== 'rejected' && (
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 gap-2"
              onClick={() => approveMutation.mutate('rejected')}
              disabled={approveMutation.isPending}
            >
              <XCircle className="w-4 h-4" />
              {t('tripApprovalBar.requestChanges')}
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowComment(!showComment)}>
            <MessageSquare className="w-4 h-4" />
            {t('tripApprovalBar.addComment')}
          </Button>
        </div>
      </div>

      {showComment && (
        <div className="mt-4 space-y-2">
          <Textarea
            placeholder={t('tripApprovalBar.commentPlaceholder')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="bg-card"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowComment(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={sendComment} disabled={isSending || !comment.trim()} className="gap-2">
              <Send className="w-4 h-4" />
              {isSending ? t('tripApprovalBar.sending') : t('tripApprovalBar.sendComment')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
