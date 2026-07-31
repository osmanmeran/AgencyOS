import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '@/lib/DbContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { showError } from '@/lib/toast';

/**
 * Workspace-level Stripe Connect onboarding (Settings → Integrations). Each
 * workspace onboards its own Stripe Express account via a hosted Account
 * Link — funds settle directly into the agency's own Stripe account, not the
 * platform's. Mirrors the Outlook connect card above it: idle/connected/
 * not-connected states, a single connect action.
 */
export default function StripeConnectPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null); // null while loading
  const [busy, setBusy] = useState(false);

  const loadStatus = async () => {
    try {
      setStatus(await db.payments.connectStatus());
    } catch (err) {
      setStatus({ stripeConfigured: false, connected: false, error: err.message });
    }
  };

  useEffect(() => {
    // Returning from Stripe's hosted onboarding: sync the account's real
    // capability flags rather than trusting the redirect alone.
    if (searchParams.get('stripeOnboarding')) {
      setBusy(true);
      db.payments
        .connectSync()
        .catch(() => {})
        .finally(() => {
          setBusy(false);
          setSearchParams((params) => {
            params.delete('stripeOnboarding');
            return params;
          });
          loadStatus();
        });
    } else {
      loadStatus();
    }
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const { url } = await db.payments.connectOnboard();
      window.location.href = url;
    } catch (err) {
      showError('Could not start Stripe onboarding', err.message);
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    setBusy(true);
    try {
      setStatus(await db.payments.connectSync());
    } catch (err) {
      showError('Could not refresh Stripe status', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 bg-card">
      <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-300" />
        Online Payments (Stripe)
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Connect a Stripe account so clients can pay invoices online, and staff can send a real payment link.
      </p>

      {status === null || busy ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {busy ? 'Checking with Stripe…' : 'Checking connection status...'}
        </div>
      ) : !status.stripeConfigured ? (
        <div className="flex items-center gap-3 p-3 bg-muted border border-border rounded-lg">
          <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Online payments aren't available on this deployment (no Stripe platform key configured).
          </p>
        </div>
      ) : status.connected && status.chargesEnabled ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-300 flex-shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-300">Connected and ready to accept payments.</p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh status
          </Button>
        </div>
      ) : status.connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-300 flex-shrink-0" />
            <p className="text-sm text-orange-800 dark:text-orange-300">
              Onboarding isn't finished yet — Stripe needs a few more details before this account can accept charges.
            </p>
          </div>
          <Button onClick={handleConnect}>
            <CreditCard className="w-4 h-4 mr-2" /> Continue onboarding
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-muted border border-border rounded-lg">
            <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-muted-foreground">Not connected. Click below to set up Stripe.</p>
          </div>
          <Button onClick={handleConnect}>
            <CreditCard className="w-4 h-4 mr-2" /> Connect with Stripe
          </Button>
        </div>
      )}
    </Card>
  );
}
