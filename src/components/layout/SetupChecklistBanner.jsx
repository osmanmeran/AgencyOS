import { db } from '@/lib/DbContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import RocketLaunchRounded from '@mui/icons-material/RocketLaunchRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';

async function loadAppSettings() {
  const all = await db.entities.AppSettings.list();
  return all[0] || {};
}

async function loadPaymentSettings() {
  try {
    return await db.payments.getSettings();
  } catch {
    return { configured: false };
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
 * "Finish setting up your workspace" nudge on the Dashboard — admin only,
 * mirrors the same completion checks as the Setup Guide page (SetupWizard.jsx)
 * without duplicating its form UI. Hides itself once every step is done, or
 * once dismissed (persisted on AppSettings so one admin dismissing it doesn't
 * leave every other admin seeing it again on their next login).
 */
export default function SetupChecklistBanner({ userTier }) {
  const queryClient = useQueryClient();
  const enabled = userTier === 'admin';

  const { data: settings } = useQuery({ queryKey: ['appSettings'], queryFn: loadAppSettings, enabled });
  const { data: payments } = useQuery({ queryKey: ['setupWizard', 'payments'], queryFn: loadPaymentSettings, enabled });
  const { data: outlook } = useQuery({ queryKey: ['setupWizard', 'outlook'], queryFn: loadOutlookStatus, enabled });
  const { data: activeStaffCount } = useQuery({
    queryKey: ['setupWizard', 'staffCount'],
    queryFn: loadActiveStaffCount,
    enabled,
  });

  const dismissMutation = useMutation({
    mutationFn: () => {
      const payload = { setup_wizard_dismissed: true };
      return settings?.id ? db.entities.AppSettings.update(settings.id, payload) : db.entities.AppSettings.create(payload);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appSettings'] }),
  });

  if (!enabled || !settings) return null;
  if (settings.setup_wizard_dismissed) return null;

  const stepsDone = [
    Boolean(settings.logo_url),
    Boolean(settings.invoice_header?.company_name),
    Boolean(payments?.configured),
    Boolean(outlook?.connected),
    (activeStaffCount || 0) >= 2,
  ];
  const doneCount = stepsDone.filter(Boolean).length;
  if (doneCount === stepsDone.length) return null;

  return (
    <Card sx={{ borderLeft: '4px solid', borderColor: 'primary.main', bgcolor: 'action.hover' }}>
      <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
        <RocketLaunchRounded color="primary" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Finish setting up your workspace
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {doneCount} of {stepsDone.length} steps done — payments, email, branding, and your team.
          </Typography>
        </Box>
        <Link to={createPageUrl('SetupWizard')}>
          <Button variant="contained" size="small">
            Continue Setup
          </Button>
        </Link>
        <IconButton size="small" onClick={() => dismissMutation.mutate()} aria-label="Dismiss">
          <CloseRounded fontSize="small" />
        </IconButton>
      </CardContent>
    </Card>
  );
}
