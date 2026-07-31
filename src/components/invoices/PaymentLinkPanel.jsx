import { useState } from 'react';
import { db } from '@/lib/DbContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link2, Copy, CheckCircle, CreditCard, Loader2, AlertCircle } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';
import { getCurrencySymbol } from '@/lib/formatters';

/**
 * Generates a real Stripe Checkout link for the invoice's remaining balance
 * (on the workspace's connected Stripe account) that staff can copy and send
 * outside the Client Portal. Not generated eagerly on mount, since each click
 * of "Generate" creates a live Stripe Checkout Session.
 */
export default function PaymentLinkPanel({ invoice, client }) {
  const { t } = useT();
  const [state, setState] = useState('idle'); // idle | loading | ready | error
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  if (!invoice || invoice.status === 'paid' || invoice.status === 'cancelled' || !(invoice.amount_due > 0)) {
    return null;
  }

  const handleGenerate = async () => {
    setState('loading');
    setError('');
    try {
      const { url } = await db.payments.createCheckoutSession(invoice.id);
      setLink(url);
      setState('ready');
    } catch (err) {
      setError(err.message);
      setState('error');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 dark:from-blue-950/40 to-indigo-50 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="bg-blue-600 p-1.5 rounded-lg">
          <CreditCard className="w-4 h-4 text-white" />
        </div>
        <h3 className="font-semibold text-foreground">{t('paymentLink.title')}</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        {t('paymentLink.shareText', {
          client: client?.name || t('paymentLink.defaultClient'),
          amount: `${getCurrencySymbol(invoice.currency || 'USD')}${invoice.amount_due?.toFixed(2)}`,
        })}
      </p>

      {state === 'ready' ? (
        <>
          <div className="flex gap-2">
            <Input readOnly value={link} className="text-xs bg-card font-mono" onClick={(e) => e.target.select()} />
            <Button onClick={handleCopy} variant="outline" size="icon" className="shrink-0">
              {copied ? (
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-300" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
          <Button onClick={handleCopy} className="w-full">
            <Link2 className="w-4 h-4 mr-2" />
            {copied ? t('paymentLink.linkCopied') : t('paymentLink.copyPaymentLink')}
          </Button>
        </>
      ) : (
        <Button onClick={handleGenerate} disabled={state === 'loading'} className="w-full">
          {state === 'loading' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Link2 className="w-4 h-4 mr-2" />
          )}
          {t('paymentLink.generate')}
        </Button>
      )}

      {state === 'error' && (
        <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">💡 {t('paymentLink.footerTip')}</p>
    </div>
  );
}
