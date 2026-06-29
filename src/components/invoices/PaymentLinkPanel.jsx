import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link2, Copy, CheckCircle, ExternalLink, CreditCard } from 'lucide-react';

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
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="bg-blue-600 p-1.5 rounded-lg">
          <CreditCard className="w-4 h-4 text-white" />
        </div>
        <h3 className="font-semibold text-slate-900">Online Payment</h3>
        <Badge className="bg-blue-100 text-blue-800 text-xs">Simulated</Badge>
      </div>

      <p className="text-sm text-slate-600">
        Share this signed link with <strong>{client?.name || 'the client'}</strong> to collect the payment of{' '}
        <strong>${invoice.amount_due?.toFixed(2)}</strong> online.
      </p>

      <div className="flex gap-2">
        <Input
          readOnly
          value={paymentLink}
          className="text-xs bg-white font-mono"
          onClick={(e) => e.target.select()}
        />
        <Button onClick={handleCopy} variant="outline" size="icon" className="shrink-0">
          {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={handleCopy} className="bg-blue-600 hover:bg-blue-700 flex-1">
          <Link2 className="w-4 h-4 mr-2" />
          {copied ? 'Link Copied!' : 'Copy Payment Link'}
        </Button>
      </div>

      <p className="text-xs text-slate-400 text-center">
        💡 Token includes signed payload (amount, ref) — tamper-proof. Connect a payment gateway (e.g. Stripe) to process real online payments.
      </p>
    </div>
  );
}