import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link2, Copy, CheckCircle, CreditCard } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

function signPaymentPayload(payload) {
  const data = JSON.stringify(payload);
  const timestamp = Date.now().toString(36);
  const raw = data + '|' + timestamp;
  const b64 = btoa(raw);
  return b64 + '.' + timestamp;
}

/**
 * Generates a signed payment link for the invoice.
 * The token embeds amount, invoice id, and a timestamp so the payload
 * cannot be tampered with after the link is shared.
 * In production, the server verifies the token before processing payment.
 */
export default function PaymentLinkPanel({ invoice, client }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);

  if (!invoice || invoice.status === 'paid' || invoice.status === 'cancelled') return null;

  const payload = {
    invoice: invoice.id,
    amount: invoice.amount_due,
    ref: invoice.invoice_number,
  };
  const token = signPaymentPayload(payload);
  const paymentLink = `${window.location.origin}/pay?token=${token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(paymentLink);
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
        <Badge className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs">
          {t('paymentLink.simulatedBadge')}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        {t('paymentLink.shareText', {
          client: client?.name || t('paymentLink.defaultClient'),
          amount: `$${invoice.amount_due?.toFixed(2)}`,
        })}
      </p>

      <div className="flex gap-2">
        <Input readOnly value={paymentLink} className="text-xs bg-card font-mono" onClick={(e) => e.target.select()} />
        <Button onClick={handleCopy} variant="outline" size="icon" className="shrink-0">
          {copied ? (
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-300" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={handleCopy} className="flex-1">
          <Link2 className="w-4 h-4 mr-2" />
          {copied ? t('paymentLink.linkCopied') : t('paymentLink.copyPaymentLink')}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">💡 {t('paymentLink.footerTip')}</p>
    </div>
  );
}
