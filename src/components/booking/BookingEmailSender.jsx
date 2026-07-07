import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, Eye, Loader2, FileCode } from 'lucide-react';
import { escapeHtml, sanitizeEmailHtml } from '@/lib/sanitize';

const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<style>
body { font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
.container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; }
.header h1 { margin: 0 0 10px 0; font-size: 24px; }
.header p { margin: 0; opacity: 0.9; }
.content { padding: 30px; }
.info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
.info-row:last-child { border-bottom: none; }
.label { color: #666; font-weight: 500; }
.value { color: #333; font-weight: 600; }
.details-box { background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 20px; }
.footer { background: #f8fafc; padding: 20px 30px; text-align: center; color: #666; font-size: 14px; }
</style>
</head>
<body>
<div class="container">
<div class="header">
<h1>Booking Request</h1>
<p>Reference: {{reference_number}}</p>
</div>
<div class="content">
<div class="info-row"><span class="label">Service Date:</span><span class="value">{{service_date}}</span></div>
<div class="info-row"><span class="label">Number of Guests:</span><span class="value">{{num_guests}}</span></div>
<div class="info-row"><span class="label">Trip Name:</span><span class="value">{{trip_name}}</span></div>
<div class="info-row"><span class="label">Client:</span><span class="value">{{client_name}}</span></div>
<div class="info-row"><span class="label">Total Cost:</span><span class="value">{{total_cost}}</span></div>
<div class="details-box">
<h3 style="margin-top:0;">Service Details</h3>
<p>{{service_details}}</p>
</div>
</div>
<div class="footer">
<p>Please confirm this booking at your earliest convenience.</p>
<p>{{company_name}}</p>
</div>
</div>
</body>
</html>`;

export default function BookingEmailSender({ open, onClose, booking, supplier, trip, client }) {
  const [recipientEmail, setRecipientEmail] = useState(supplier?.email || '');
  const [subject, setSubject] = useState(`Booking Request - ${booking?.reference_number || ''}`);
  const [selectedTemplate, setSelectedTemplate] = useState('default');
  const [customHtml, setCustomHtml] = useState('');
  //   const [previewMode, setPreviewMode] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: templates = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['bookingTemplates'],
      queryFn: () => db.entities.BookingTemplate.list(),
    })
  );

  const { data: settings } = /** @type {any} */ (
    useQuery({
      queryKey: ['appSettings'],
      queryFn: async () => {
        const all = await db.entities.AppSettings.list();
        return all[0] || {};
      },
    })
  );

  const getProcessedHtml = () => {
    let html =
      selectedTemplate === 'custom'
        ? customHtml
        : selectedTemplate === 'default'
          ? DEFAULT_TEMPLATE
          : templates.find((t) => t.id === selectedTemplate)?.html_content || DEFAULT_TEMPLATE;

    // Replace placeholders (escape all user-controlled values)
    const replacements = {
      '{{reference_number}}': escapeHtml(booking?.reference_number || 'N/A'),
      '{{service_date}}': escapeHtml(booking?.service_date || 'N/A'),
      '{{num_guests}}': escapeHtml(booking?.num_guests?.toString() || '1'),
      '{{trip_name}}': escapeHtml(trip?.name || 'N/A'),
      '{{trip_destination}}': escapeHtml(trip?.destination || 'N/A'),
      '{{client_name}}': escapeHtml(client?.name || 'N/A'),
      '{{client_email}}': escapeHtml(client?.email || 'N/A'),
      '{{total_cost}}': escapeHtml(`$${booking?.total_cost?.toFixed(2) || '0.00'}`),
      '{{service_details}}': escapeHtml(booking?.service_details || 'No additional details'),
      '{{supplier_name}}': escapeHtml(supplier?.name || 'N/A'),
      '{{company_name}}': escapeHtml(settings?.app_name || 'TravelPro'),
    };

    Object.entries(replacements).forEach(([key, value]) => {
      html = html.replace(new RegExp(key, 'g'), value);
    });

    return sanitizeEmailHtml(html);
  };

  const sendEmail = async () => {
    setSending(true);
    await db.integrations.Core.SendEmail({
      to: recipientEmail,
      subject: subject,
      body: getProcessedHtml(),
    });
    setSending(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Booking Request Email</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Recipient Email *</Label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="supplier@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email Template</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default Template</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom HTML</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate === 'custom' && (
            <div className="space-y-2">
              <Label>Custom HTML</Label>
              <Textarea
                value={customHtml}
                onChange={(e) => setCustomHtml(e.target.value)}
                rows={10}
                placeholder="Enter custom HTML... Use placeholders like {{reference_number}}, {{service_date}}, etc."
                className="font-mono text-sm"
              />
            </div>
          )}

          <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
            <strong>Available placeholders:</strong>{' '}
            {`{{reference_number}}, {{service_date}}, {{num_guests}}, {{trip_name}}, {{client_name}}, {{total_cost}}, {{service_details}}, {{supplier_name}}, {{company_name}}`}
          </div>

          <Tabs defaultValue="preview">
            <TabsList>
              <TabsTrigger value="preview">
                <Eye className="w-4 h-4 mr-2" /> Preview
              </TabsTrigger>
              <TabsTrigger value="source">
                <FileCode className="w-4 h-4 mr-2" /> HTML Source
              </TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="border rounded-lg p-4 bg-card min-h-[300px]">
              <div dangerouslySetInnerHTML={{ __html: getProcessedHtml() }} />
            </TabsContent>
            <TabsContent value="source">
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-auto max-h-[300px]">
                {getProcessedHtml()}
              </pre>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={sendEmail} disabled={!recipientEmail || sending} className="bg-blue-600 hover:bg-blue-700">
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" /> Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
