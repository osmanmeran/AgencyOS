const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Bell, Loader2, CheckCircle, Mail } from 'lucide-react';

import { format } from 'date-fns';

export default function PaymentReminderButton({ invoice, client, settings = /** @type {any} */ ({}), variant = 'default' }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');

  if (!invoice || !client?.email) return null;
  if (invoice.status === 'paid' || invoice.status === 'cancelled') return null;

  const companyName = settings?.invoice_header?.company_name || 'TravelPro';
  const dueDate = format(new Date(invoice.due_date), 'MMMM d, yyyy');
  const isOverdue = new Date(invoice.due_date) < new Date();

  const defaultMessage = `Dear ${client?.name},

This is a ${isOverdue ? 'final' : 'friendly'} reminder that invoice ${invoice.invoice_number} for $${invoice.amount_due?.toFixed(2)} is ${isOverdue ? 'overdue' : 'due on ' + dueDate}.

${isOverdue ? `The payment was due on ${dueDate} and has not yet been received. Please arrange payment at your earliest convenience to avoid any disruption to your reservation.` : `Please ensure payment is made before the due date.`}

Invoice Number: ${invoice.invoice_number}
Amount Due: $${invoice.amount_due?.toFixed(2)}
Due Date: ${dueDate}

If you have already made the payment, please disregard this notice.

Thank you for your prompt attention.

Best regards,
${companyName}`;

  const handleOpen = () => { setMessage(defaultMessage); setOpen(true); };

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
        className={isOverdue ? 'border-red-400 text-red-600 hover:bg-red-50' : 'border-orange-400 text-orange-600 hover:bg-orange-50'}
        title="Send Payment Reminder"
      >
        <Bell className="w-4 h-4" />
        {variant !== 'icon' && <span className="ml-2">Send Reminder</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-orange-600" />
              {isOverdue ? 'Overdue Notice' : 'Payment Reminder'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <div className="text-slate-500">Sending to:</div>
              <div className="font-semibold text-slate-900">{client.name} &lt;{client.email}&gt;</div>
              <div className="text-slate-500 mt-1">Invoice: <span className="font-semibold">{invoice.invoice_number}</span> · Due: <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>${invoice.amount_due?.toFixed(2)}</span></div>
            </div>

            <div className="space-y-1">
              <Label>Email Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={10}
                className="text-sm font-mono"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSend}
                disabled={sending || sent}
                className={isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}
              >
                {sent ? (
                  <><CheckCircle className="w-4 h-4 mr-2" />Sent!</>
                ) : sending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                ) : (
                  <><Mail className="w-4 h-4 mr-2" />Send Email</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}