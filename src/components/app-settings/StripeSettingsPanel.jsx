import { useEffect, useState } from 'react';
import { db } from '@/lib/DbContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, CheckCircle2, AlertCircle, Loader2, Copy, CheckCircle } from 'lucide-react';
import { showError, showSuccess } from '@/lib/toast';

/**
 * Workspace-level, bring-your-own-key Stripe settings (Settings ->
 * Integrations). Each workspace pastes its own Stripe secret key and webhook
 * signing secret directly from its own Stripe Dashboard — there is no
 * platform-wide Stripe key and no Stripe Connect onboarding flow, so a new
 * workspace can accept online payments without anyone touching hosting
 * config. The webhook secret is what confirms a payment actually completed
 * (the browser landing back on the invoice page is just a UX nicety, not
 * proof of payment), so it's split out as its own optional step.
 */
export default function StripeSettingsPanel() {
  const [status, setStatus] = useState(null); // null while loading
  const [secretKeyInput, setSecretKeyInput] = useState('');
  const [webhookSecretInput, setWebhookSecretInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadStatus = async () => {
    try {
      setStatus(await db.payments.getSettings());
    } catch (err) {
      setStatus({ error: err.message });
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSave = async () => {
    const payload = {};
    if (secretKeyInput.trim()) payload.secretKey = secretKeyInput.trim();
    if (webhookSecretInput.trim()) payload.webhookSecret = webhookSecretInput.trim();
    if (!payload.secretKey && !payload.webhookSecret) return;

    setSaving(true);
    try {
      const updated = await db.payments.saveSettings(payload);
      setStatus((prev) => ({ ...prev, ...updated }));
      setSecretKeyInput('');
      setWebhookSecretInput('');
      showSuccess('Stripe settings saved');
    } catch (err) {
      showError('Could not save Stripe settings', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(status.webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Card className="p-6 bg-card">
      <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-300" />
        Online Payments (Stripe)
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Bring your own Stripe account — payments settle directly into it, and nothing here needs a hosting config
        change. Generate a secret key from your own Stripe Dashboard and paste it below.
      </p>

      {status === null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking status...
        </div>
      ) : (
        <div className="space-y-4">
          {status.configured ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-300 flex-shrink-0" />
              <p className="text-sm text-green-800 dark:text-green-300">
                Secret key configured ({status.secretKeyMasked}).
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-muted border border-border rounded-lg">
              <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <p className="text-sm text-muted-foreground">No Stripe secret key saved yet.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Stripe Secret Key</Label>
            <Input
              type="password"
              placeholder={status.configured ? status.secretKeyMasked : 'sk_live_...'}
              value={secretKeyInput}
              onChange={(e) => setSecretKeyInput(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          {status.configured && (
            <>
              <div className="pt-2 border-t border-border space-y-2">
                <Label>Webhook URL</Label>
                <p className="text-xs text-muted-foreground">
                  Create a webhook endpoint in your Stripe Dashboard pointed at this URL, listening for the{' '}
                  <code className="font-mono">checkout.session.completed</code> event, then paste the signing secret it
                  gives you below. This is what confirms a payment actually completed.
                </p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={status.webhookUrl}
                    className="text-xs bg-muted font-mono"
                    onClick={(e) => e.target.select()}
                  />
                  <Button onClick={handleCopyWebhookUrl} variant="outline" size="icon" className="shrink-0">
                    {copied ? (
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-300" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Webhook Signing Secret</Label>
                <Input
                  type="password"
                  placeholder={status.webhookConfigured ? 'whsec_•••• (configured)' : 'whsec_...'}
                  value={webhookSecretInput}
                  onChange={(e) => setWebhookSecretInput(e.target.value)}
                  className="font-mono text-xs"
                />
                {!status.webhookConfigured && (
                  <p className="text-xs text-orange-600 dark:text-orange-300">
                    Without this, payments can be started but won't be confirmed automatically.
                  </p>
                )}
              </div>
            </>
          )}

          <Button onClick={handleSave} disabled={saving || (!secretKeyInput.trim() && !webhookSecretInput.trim())}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </div>
      )}
    </Card>
  );
}
