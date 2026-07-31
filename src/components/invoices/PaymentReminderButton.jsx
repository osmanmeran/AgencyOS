import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Bell, Loader2, CheckCircle, Mail, Link2 } from 'lucide-react';

import { format } from 'date-fns';
import { useT } from '@/lib/i18n/I18nContext';

export default function PaymentReminderButton({
  invoice,
  client,
  settings = /** @type {any} */ ({}),
  variant = 'default',
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  // idle | loading | ready | unavailable — 'unavailable' means Stripe isn't
  // configured for this workspace yet, not an error worth interrupting the
  // reminder over (the email is still useful without a pay link).
  const [payLinkStatus, setPayLinkStatus] = useState('idle');

  if (!invoice || !client?.email) return null;
  if (invoice.status === 'paid' || invoice.status === 'cancelled') return null;

  const companyName = settings?.invoice_header?.company_name || 'TravelPro';
  const dueDate = format(new Date(invoice.due_date), 'MMMM d, yyyy');
  const isOverdue = new Date(invoice.due_date) < new Date();

  const buildMessage = (payLink) => `Dear ${client?.name},

This is a ${isOverdue ? 'final' : 'friendly'} reminder that invoice ${invoice.invoice_number} for $${invoice.amount_due?.toFixed(2)} is ${isOverdue ? 'overdue' : 'due on ' + dueDate}.

${isOverdue ? `The payment was due on ${dueDate} and has not yet been received. Please arrange payment at your earliest convenience to avoid any disruption to your reservation.` : `Please ensure payment is made before the due date.`}

Invoice Number: ${invoice.invoice_number}
Amount Due: $${invoice.amount_due?.toFixed(2)}
Due Date: ${dueDate}
${payLink ? `\nPay online now: ${payLink}\n` : ''}
If you have already made the payment, please disregard this notice.

Thank you for your prompt attention.

Best regards,
${companyName}`;

  const handleOpen = async () => {
    const withoutLink = buildMessage(null);
    setMessage(withoutLink);
    setPayLinkStatus('loading');
    setOpen(true);

    try {
      const { url } = await db.payments.createCheckoutSession(invoice.id);
      setPayLinkStatus('ready');
      // Only splice the link in if the admin hasn't started editing yet —
      // clobbering an in-progress edit just because the link finished
      // loading would be surprising.
      setMessage((prev) => (prev === withoutLink ? buildMessage(url) : prev));
    } catch (err) {
      setPayLinkStatus(err.code === 'STRIPE_NOT_CONFIGURED' ? 'unavailable' : 'error');
    }
  };

  const handleSend = async () => {
    setSending(true);
    await db.integrations.Core.SendEmail({
      to: client.email,
      subject: `${isOverdue ? '[OVERDUE] ' : ''}Payment Reminder – Invoice ${invoice.invoice_number}`,
      body: message,
    });
    setSending(false);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setOpen(false);
    }, 2000);
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        variant={variant === 'icon' ? 'ghost' : 'outline'}
        size={variant === 'icon' ? 'icon' : 'default'}
        className={
          isOverdue
            ? 'border-red-400 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40'
            : 'border-orange-400 text-orange-600 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/40'
        }
        title={t('paymentReminderButton.sendReminderTitle')}
      >
        <Bell className="w-4 h-4" />
        {variant !== 'icon' && <span className="ml-2">{t('paymentReminderButton.sendReminder')}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-orange-600 dark:text-orange-300" />
              {isOverdue ? t('paymentReminderButton.overdueNotice') : t('paymentReminderButton.paymentReminder')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="bg-muted rounded-lg p-3 text-sm">
              <div className="text-muted-foreground">{t('paymentReminderButton.sendingTo')}</div>
              <div className="font-semibold text-foreground">
                {client.name} &lt;{client.email}&gt;
              </div>
              <div className="text-muted-foreground mt-1">
                {t('paymentReminderButton.invoiceLabel')}{' '}
                <span className="font-semibold">{invoice.invoice_number}</span> · {t('paymentReminderButton.dueLabel')}{' '}
                <span className={isOverdue ? 'text-red-600 dark:text-red-300 font-semibold' : ''}>
                  ${invoice.amount_due?.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>{t('paymentReminderButton.emailMessageLabel')}</Label>
                {payLinkStatus === 'loading' && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> Adding payment link…
                  </span>
                )}
                {payLinkStatus === 'ready' && (
                  <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-300">
                    <Link2 className="w-3 h-3" /> Payment link included
                  </span>
                )}
                {payLinkStatus === 'unavailable' && (
                  <span className="text-xs text-muted-foreground">
                    Connect Stripe in Settings to include a pay-online link
                  </span>
                )}
              </div>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={10}
                className="text-sm font-mono"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending || sent}
                className={isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}
              >
                {sent ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t('paymentReminderButton.sent')}
                  </>
                ) : sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('tripApprovalBar.sending')}
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    {t('paymentReminderButton.sendEmail')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
