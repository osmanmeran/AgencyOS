import { db } from '@/lib/DbContext';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Send, Wand2, ChevronDown, ChevronUp } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

// Built-in templates
const TEMPLATES = {
  proposal: {
    label: 'Proposal',
    subject: 'Your Travel Proposal – {{proposal_title}}',
    body: `Dear {{client_name}},

I'm excited to share your personalized travel proposal with you.

📋 Proposal: {{proposal_title}}
🌍 Destination: {{destination}}
📅 Dates: {{start_date}} – {{end_date}}
💰 Total: {{total_amount}}

Please review the details and let me know if you'd like any adjustments. I'm happy to tailor this further to match your preferences.

Looking forward to your thoughts!

Best regards,
{{agent_name}}`,
  },
  invoice: {
    label: 'Invoice',
    subject: 'Invoice {{invoice_number}} – {{total_amount}} Due',
    body: `Dear {{client_name}},

Please find your invoice details below.

🧾 Invoice: {{invoice_number}}
💰 Total Amount: {{total_amount}}
📅 Due Date: {{due_date}}

Kindly arrange payment at your earliest convenience. If you have any questions, don't hesitate to reach out.

Thank you for your business!

Best regards,
{{agent_name}}`,
  },
  custom: {
    label: 'Custom',
    subject: '',
    body: `Dear {{client_name}},\n\n\n\nBest regards,\n{{agent_name}}`,
  },
};

// Resolve {{variable}} tokens in a string
function resolveTemplate(text, variables) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

export default function EmailComposer({ open, onClose, client, proposal, invoice }) {
  const { t } = useT();
  const queryClient = useQueryClient();

  const templateType = proposal ? 'proposal' : invoice ? 'invoice' : 'custom';
  const tpl = TEMPLATES[templateType];

  // Build variable map
  const variables = {
    client_name: client?.name || '',
    proposal_title: proposal?.title || '',
    destination: proposal?.destination || '',
    start_date: proposal?.start_date || '',
    end_date: proposal?.end_date || '',
    total_amount: proposal
      ? `$${(proposal.total_cost || 0).toFixed(2)}`
      : invoice
        ? `$${(invoice.total_amount || 0).toFixed(2)}`
        : '',
    invoice_number: invoice?.invoice_number || '',
    due_date: invoice?.due_date || '',
    agent_name: '', // filled from current user below
  };

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [toEmail, setToEmail] = useState('');

  // Load current user name
  useEffect(() => {
    db.auth
      .me()
      .then((u) => {
        const name = u?.full_name || u?.email || '';
        setAgentName(name);
      })
      .catch(() => {});
  }, []);

  // Reset when opened/template changes
  useEffect(() => {
    if (open) {
      const vars = { ...variables, agent_name: agentName };
      setSubject(resolveTemplate(tpl.subject, vars));
      setBody(resolveTemplate(tpl.body, vars));
      setShowPreview(false);
      setToEmail(client?.email || '');
    }
  }, [open, agentName]);

  const sendMutation = /** @type {any} */ (
    useMutation({
      mutationFn: async () => {
        const me = await db.auth.me();
        // Send the actual email
        await db.integrations.Core.SendEmail({
          to: toEmail,
          subject,
          body,
        });
        // Log it
        await db.entities.EmailLog.create({
          client_id: client.id,
          to_email: toEmail,
          subject,
          body,
          template_type: templateType,
          reference_id: proposal?.id || invoice?.id || null,
          reference_label: proposal?.title || invoice?.invoice_number || null,
          sent_by: me?.email || '',
          status: 'sent',
        });
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['emailLogs', client.id] });
        onClose();
      },
    })
  );

  const resolvedSubject = resolveTemplate(subject, { ...variables, agent_name: agentName });
  const resolvedBody = resolveTemplate(body, { ...variables, agent_name: agentName });

  const variableTokens = [
    ['{{client_name}}', client?.name],
    ['{{total_amount}}', variables.total_amount],
    ...(proposal
      ? [
          ['{{proposal_title}}', proposal.title],
          ['{{destination}}', proposal.destination],
          ['{{start_date}}', proposal.start_date],
          ['{{end_date}}', proposal.end_date],
        ]
      : []),
    ...(invoice
      ? [
          ['{{invoice_number}}', invoice.invoice_number],
          ['{{due_date}}', invoice.due_date],
        ]
      : []),
    ['{{agent_name}}', agentName],
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-600 dark:text-blue-300" />
            {templateType === 'proposal'
              ? t('emailComposer.sendProposal')
              : templateType === 'invoice'
                ? t('emailComposer.sendInvoice')
                : t('emailComposer.sendEmailTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* To */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('emailComposer.toLabel')}</Label>
            <Input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              className="text-sm"
              placeholder="client@example.com"
            />
          </div>

          {/* Subject */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('emailComposer.subjectLabel')}</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="text-sm"
              placeholder={t('emailComposer.subjectPlaceholder')}
            />
          </div>

          {/* Variable chips */}
          <div>
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Wand2 className="w-3 h-3" /> {t('emailComposer.availableVariables')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {variableTokens.map(([token, val]) => (
                <button
                  key={token}
                  type="button"
                  title={`Inserts: ${val || token}`}
                  onClick={() => setBody((prev) => prev + token)}
                  className="text-xs bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded px-2 py-0.5 font-mono transition-colors"
                >
                  {token}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('emailComposer.messageLabel')}</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="text-sm font-mono resize-none"
              placeholder={t('emailComposer.messagePlaceholder')}
            />
          </div>

          {/* Preview toggle */}
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {showPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showPreview ? t('emailComposer.hidePreview') : t('emailComposer.showPreview')}
          </button>

          {showPreview && (
            <div className="bg-muted border border-border rounded-xl p-4 text-sm whitespace-pre-wrap text-foreground font-sans">
              <div className="font-semibold mb-2 text-foreground">{resolvedSubject}</div>
              <div className="text-muted-foreground">{resolvedBody}</div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !toEmail}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-4 h-4 mr-2" />
              {sendMutation.isPending ? t('emailComposer.sending') : t('emailComposer.sendEmailButton')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
