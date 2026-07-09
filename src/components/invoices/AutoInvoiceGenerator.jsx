import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Zap, CheckCircle, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { useT } from '@/lib/i18n/I18nContext';

const MILESTONE_CONFIG = [
  { key: 'deposit', labelKey: 'milestoneDepositLabel', descKey: 'milestoneDepositDesc', percentage: 0.3, dueDays: 7 },
  {
    key: 'midpoint',
    labelKey: 'milestoneMidpointLabel',
    descKey: 'milestoneMidpointDesc',
    percentage: 0.4,
    dueDays: 14,
  },
  { key: 'final', labelKey: 'milestoneFinalLabel', descKey: 'milestoneFinalDesc', percentage: 0.3, dueDays: 3 },
  { key: 'full', labelKey: 'milestoneFullLabel', descKey: 'milestoneFullDesc', percentage: 1.0, dueDays: 14 },
];

export default function AutoInvoiceGenerator({ trip, client, existingInvoices = [], settings }) {
  const { t } = useT();
  const MILESTONES = MILESTONE_CONFIG.map((m) => ({
    ...m,
    label: t(`autoInvoiceGenerator.${m.labelKey}`),
    description: t(`autoInvoiceGenerator.${m.descKey}`),
  }));
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const totalAmount = trip.final_price || trip.total_expenses || 0;

  const existingMilestoneKeys = existingInvoices.map((inv) => inv.milestone_key).filter(Boolean);

  const generateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: async (/** @type {any} */ milestone) => {
        const amount = parseFloat((totalAmount * milestone.percentage).toFixed(2));
        const issueDate = new Date().toISOString().split('T')[0];
        const dueDate = addDays(new Date(), milestone.dueDays).toISOString().split('T')[0];
        const invoiceNumber = `INV-${trip.reference_number || trip.id.slice(0, 6).toUpperCase()}-${milestone.key.toUpperCase()}-${Date.now().toString().slice(-4)}`;

        const lineItems = [
          {
            description: `${trip.name} – ${milestone.description}`,
            quantity: 1,
            unit_price: amount,
            amount,
          },
        ];

        const invoice = await db.entities.Invoice.create({
          invoice_number: invoiceNumber,
          client_id: trip.client_id,
          trip_id: trip.id,
          issue_date: issueDate,
          due_date: dueDate,
          line_items: lineItems,
          subtotal: amount,
          tax_rate: 0,
          tax_amount: 0,
          total_amount: amount,
          amount_paid: 0,
          amount_due: amount,
          status: 'draft',
          milestone_key: milestone.key,
          notes: `Auto-generated ${milestone.label} invoice for reservation ${trip.reference_number || trip.name}.`,
          payment_terms: settings?.default_payment_terms || 'Due within 30 days',
        });

        // Notify client by email
        if (client?.email) {
          await db.integrations.Core.SendEmail({
            to: client.email,
            subject: `Invoice ${invoiceNumber} – ${trip.name}`,
            body: `Dear ${client.name},\n\nPlease find attached your invoice ${invoiceNumber} for the amount of $${amount.toFixed(2)}.\n\nDue date: ${format(new Date(dueDate), 'MMM d, yyyy')}\n\nThank you for choosing us.\n\nBest regards,\n${settings?.invoice_header?.company_name || 'TravelPro'}`,
          });
        }

        return invoice;
      },
      onSuccess: (invoice) => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['tripInvoices'] });
        setOpen(false);
        navigate(createPageUrl(`InvoiceDetails?id=${invoice.id}`));
      },
    })
  );

  if (!totalAmount) return null;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        className="border-purple-400 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
      >
        <Zap className="w-4 h-4 mr-2" />
        {t('autoInvoiceGenerator.autoGenerateInvoice')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-600 dark:text-purple-300" />
              {t('autoInvoiceGenerator.autoGenerateInvoice')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="bg-muted rounded-lg p-3 text-sm text-foreground">
              <span className="font-semibold">{t('autoInvoiceGenerator.tripTotalLabel')}</span> $
              {totalAmount.toFixed(2)}
              {client && <span className="ml-4 font-semibold">{t('autoInvoiceGenerator.clientColonLabel')}</span>}
              {client && <span className="ml-1">{client.name}</span>}
            </div>

            <p className="text-sm text-muted-foreground">{t('autoInvoiceGenerator.selectMilestoneHint')}</p>

            <div className="space-y-2">
              {MILESTONES.map((m) => {
                const alreadyExists = existingMilestoneKeys.includes(m.key);
                const isSelected = selected?.key === m.key;
                return (
                  <button
                    key={m.key}
                    disabled={alreadyExists}
                    onClick={() => setSelected(m)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      alreadyExists
                        ? 'border-border bg-muted opacity-50 cursor-not-allowed'
                        : isSelected
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40'
                          : 'border-border hover:border-purple-300 dark:hover:border-purple-800 hover:bg-purple-50/50 dark:hover:bg-purple-950/50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-foreground">{m.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {m.description} · {t('autoInvoiceGenerator.dueInDays', { days: m.dueDays })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">${(totalAmount * m.percentage).toFixed(2)}</span>
                        {alreadyExists && (
                          <Badge className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {t('autoInvoiceGenerator.doneBadge')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {client?.email && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/40 rounded p-2">
                <CheckCircle className="w-3 h-3 text-blue-500 dark:text-blue-300" />
                {t('autoInvoiceGenerator.notifyEmailHint', { email: client.email })}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => generateMutation.mutate(selected)}
                disabled={!selected || generateMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('autoInvoiceGenerator.generating')}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    {t('autoInvoiceGenerator.generateInvoice')}
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
