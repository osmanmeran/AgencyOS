import { db } from '@/lib/DbContext';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { usePermissions } from '@/components/permissions/PermissionContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Palette,
  FileText,
  CreditCard,
  Mail,
  Users,
  ShieldCheck,
  CheckCircle2,
  Circle,
  ArrowRight,
} from 'lucide-react';

async function loadAppSettings() {
  const all = await db.entities.AppSettings.list();
  return all[0] || {};
}

async function loadPaymentSettings() {
  try {
    return await db.payments.getSettings();
  } catch {
    return { configured: false, webhookConfigured: false };
  }
}

async function loadOutlookStatus() {
  try {
    return await db.integrations.Core.OutlookStatus();
  } catch {
    return { connected: false };
  }
}

async function loadActiveStaffCount() {
  try {
    const users = await db.auth.users();
    return users.filter((u) => u.is_active && u.user_tier !== 'client' && u.user_tier !== 'supplier').length;
  } catch {
    return 0;
  }
}

/**
 * A dismissible checklist for finishing a new workspace's setup — branding,
 * invoice header, online payments, Outlook email, and inviting the rest of
 * the team. Not blocking: reachable anytime from the nav (admin/manager),
 * every step just links into the real settings page/section rather than
 * duplicating its form here.
 */
export default function SetupWizard() {
  const { hasPermission } = usePermissions();

  const { data: settings } = useQuery({ queryKey: ['appSettings'], queryFn: loadAppSettings });
  const { data: payments } = useQuery({ queryKey: ['setupWizard', 'payments'], queryFn: loadPaymentSettings });
  const { data: outlook } = useQuery({ queryKey: ['setupWizard', 'outlook'], queryFn: loadOutlookStatus });
  const { data: activeStaffCount } = useQuery({
    queryKey: ['setupWizard', 'staffCount'],
    queryFn: loadActiveStaffCount,
  });

  if (!hasPermission('manage_app_settings')) {
    return (
      <Card className="p-12 text-center">
        <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">Access denied</h3>
        <p className="text-muted-foreground">Only a workspace admin can view the setup guide.</p>
      </Card>
    );
  }

  const steps = [
    {
      key: 'branding',
      icon: Palette,
      title: 'Branding',
      description: 'Set your agency name and logo so the app and client-facing documents look like yours.',
      done: Boolean(settings?.logo_url),
      href: createPageUrl('AppSettings') + '?tab=general',
      cta: 'Go to Branding',
    },
    {
      key: 'invoice_header',
      icon: FileText,
      title: 'Invoice Details',
      description: 'Add your company name, address, and tax ID so invoices and proposals look official.',
      done: Boolean(settings?.invoice_header?.company_name),
      href: createPageUrl('AppSettings') + '?tab=general',
      cta: 'Go to Invoice Details',
    },
    {
      key: 'payments',
      icon: CreditCard,
      title: 'Online Payments',
      description:
        'Connect your own Stripe account so clients can pay invoices online, and staff can send real payment links.',
      done: Boolean(payments?.configured),
      partial: Boolean(payments?.configured && !payments?.webhookConfigured),
      href: createPageUrl('AppSettings') + '?tab=integrations',
      cta: 'Go to Payments',
    },
    {
      key: 'outlook',
      icon: Mail,
      title: 'Outlook Email',
      description: 'Connect Microsoft 365 to send proposals, invoices, and reminders from your own mailbox.',
      done: Boolean(outlook?.connected),
      href: createPageUrl('AppSettings') + '?tab=integrations',
      cta: 'Go to Email',
    },
    {
      key: 'team',
      icon: Users,
      title: 'Invite Your Team',
      description: "Add the rest of your agency's staff so work isn't stuck on one account.",
      done: (activeStaffCount || 0) >= 2,
      href: createPageUrl('UserManagement'),
      cta: 'Go to User Management',
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Setup Guide</h1>
        <p className="text-muted-foreground">
          A few things worth doing before this workspace is fully up and running. Nothing here is required — skip
          anything you don't need, come back anytime from Settings.
        </p>
      </div>

      <Card className="p-5 bg-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            {doneCount} of {steps.length} done
          </span>
          <span className="text-sm text-muted-foreground">{progress}%</span>
        </div>
        <Progress value={progress} />
      </Card>

      <div className="space-y-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Card key={step.key} className="p-5 bg-card">
              <div className="flex items-start gap-4">
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    step.done
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{step.title}</h3>
                    {step.done ? (
                      <Badge className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-xs gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Done
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Circle className="w-3 h-3" /> Not set up
                      </Badge>
                    )}
                    {step.partial && (
                      <Badge className="bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 text-xs">
                        Webhook not configured yet
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                </div>
                <Link to={step.href} className="shrink-0">
                  <Button variant={step.done ? 'outline' : 'default'} size="sm" className="gap-1">
                    {step.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-5 bg-card">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg shrink-0 bg-muted text-muted-foreground">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">Review Permissions</h3>
              <Badge variant="secondary" className="text-xs">
                Optional
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Check what each staff tier (manager, agent, accounting) can see and do, and adjust if the defaults don't
              fit your agency.
            </p>
          </div>
          <Link to={createPageUrl('AppSettings') + '?tab=permissions'} className="shrink-0">
            <Button variant="outline" size="sm" className="gap-1">
              Go to Permissions
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </Card>

      <p className="text-sm text-muted-foreground text-center">
        New to the app? The{' '}
        <Link to={createPageUrl('GettingStarted')} className="underline hover:text-foreground">
          Getting Started guide
        </Link>{' '}
        walks through day-to-day workflows — suppliers, clients, trips, and more.
      </p>
    </div>
  );
}
