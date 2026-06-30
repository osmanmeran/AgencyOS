const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Zap, CheckCircle, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../../utils';

const MILESTONES = [
  {
    key: 'deposit',
    label: 'Deposit (30%)',
    description: 'Initial deposit invoice',
    percentage: 0.30,
    dueDays: 7,
  },
  {
    key: 'midpoint',
    label: 'Mid-payment (40%)',
    description: 'Mid-trip payment invoice',
    percentage: 0.40,
    dueDays: 14,
  },
  {
    key: 'final',
    label: 'Final Balance (30%)',
    description: 'Final balance invoice',
    percentage: 0.30,
    dueDays: 3,
  },
  {
    key: 'full',
    label: 'Full Amount (100%)',
    description: 'Single full-payment invoice',
    percentage: 1.0,
    dueDays: 14,
  },
];

export default function AutoInvoiceGenerator({ trip, client, existingInvoices = [], settings }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const totalAmount = trip.final_price || trip.total_expenses || 0;

  const existingMilestoneKeys = existingInvoices
    .map(inv => inv.milestone_key)
    .filter(Boolean);

  const generateMutation = /** @type {any} */ (useMutation({
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
  }));

  if (!totalAmount) return null;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        className="border-purple-400 text-purple-700 hover:bg-purple-50"
      >
        <Zap className="w-4 h-4 mr-2" />
        Auto-Generate Invoice
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-600" />
              Auto-Generate Invoice
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700">
              <span className="font-semibold">Trip total:</span> ${totalAmount.toFixed(2)}
              {client && <span className="ml-4 font-semibold">Client:</span>}
              {client && <span className="ml-1">{client.name}</span>}
            </div>

            <p className="text-sm text-slate-600">Select a billing milestone to auto-generate an invoice:</p>

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
                        ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                        : isSelected
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50/50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-slate-900">{m.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{m.description} · Due in {m.dueDays} days</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">${(totalAmount * m.percentage).toFixed(2)}</span>
                        {alreadyExists && (
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />Done
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {client?.email && (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-blue-50 rounded p-2">
                <CheckCircle className="w-3 h-3 text-blue-500" />
                Invoice notification will be emailed to {client.email}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() => generateMutation.mutate(selected)}
                disabled={!selected || generateMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><Zap className="w-4 h-4 mr-2" />Generate Invoice</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}