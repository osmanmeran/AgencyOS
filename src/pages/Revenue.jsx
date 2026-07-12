import { db } from '@/lib/DbContext';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import { useTheme } from '@mui/material/styles';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkeletonStats } from '@/components/ui/skeletons';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format, parseISO, isPast } from 'date-fns';
import {
  DollarSign,
  AlertCircle,
  FileText,
  TrendingUp,
  ArrowRight,
  Plus,
  Search,
  Calendar,
  Bell,
  Loader2,
  Trash2,
  Download,
} from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import ReportsSection from '../components/reports/ReportsSection';
import ScheduledReportsCard from '../components/reports/ScheduledReportsCard';
import PaymentReminderButton from '../components/invoices/PaymentReminderButton';
import { useExport } from '@/hooks/useExport';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getCurrencySymbol } from '@/lib/formatters';

// Maps invoice status to a MUI Chip color so badges adapt to light/dark mode
// via the theme rather than hardcoded Tailwind colors.
const INVOICE_STATUS_CHIP = {
  draft: 'default',
  sent: 'info',
  paid: 'success',
  overdue: 'error',
  cancelled: 'default',
};

/**
 * Compact metric card matching the Dashboard visual language: a muted surface
 * with a colored left border, a small labelled header, and a large value.
 * @param {{ label: string, value: React.ReactNode, icon: React.ReactNode, color?: string }} props
 */
function StatCard({ label, value, icon, color = 'primary' }) {
  return (
    <Card sx={{ height: '100%', borderLeft: '4px solid', borderColor: `${color}.main` }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {label}
          </Typography>
          <Box sx={{ color: `${color}.main`, display: 'flex' }}>{icon}</Box>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

function OverviewTab() {
  const { data: overview = /** @type {any} */ ({}) } = /** @type {any} */ (
    useQuery({
      queryKey: ['revenueOverview'],
      queryFn: () => db.reports.revenueOverview(),
    })
  );

  const {
    totalRevenue = 0,
    totalOutstanding = 0,
    monthlyConfirmedRevenue = 0,
    monthlyConfirmedCount = 0,
    pendingProposals = 0,
    proposalAcceptRate = 0,
    upcomingPaymentDues = [],
  } = overview;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Quick Stats */}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Total Revenue"
            color="success"
            icon={<DollarSign className="w-5 h-5" />}
            value={`$${totalRevenue.toFixed(0)}`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Outstanding"
            color="warning"
            icon={<AlertCircle className="w-5 h-5" />}
            value={`$${totalOutstanding.toFixed(0)}`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Pending Proposals"
            color="primary"
            icon={<FileText className="w-5 h-5" />}
            value={pendingProposals}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Accept Rate"
            color="secondary"
            icon={<TrendingUp className="w-5 h-5" />}
            value={`${proposalAcceptRate}%`}
          />
        </Grid>
      </Grid>

      {/* Monthly Confirmed Revenue + Payment Dues */}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%', borderLeft: '4px solid', borderColor: 'success.main' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Confirmed Revenue
                </Typography>
                <Box
                  sx={{ bgcolor: 'success.light', p: 1, borderRadius: '8px', display: 'flex', color: 'success.main' }}
                >
                  <DollarSign className="w-4 h-4" />
                </Box>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.dark', mb: 0.5 }}>
                $
                {monthlyConfirmedRevenue.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                From {monthlyConfirmedCount} confirmed reservation{monthlyConfirmedCount !== 1 ? 's' : ''} this month
              </Typography>
              <Box
                component={Link}
                to={createPageUrl('Reservations')}
                sx={{
                  mt: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  fontSize: '0.75rem',
                  color: 'success.main',
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                View confirmed <ArrowRight className="w-3 h-3" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Box sx={{ color: 'warning.main', display: 'flex' }}>
                  <DollarSign className="w-5 h-5" />
                </Box>
                Upcoming Payment Dues
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 320, overflow: 'auto' }}>
                {upcomingPaymentDues.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No upcoming payments
                  </Typography>
                ) : (
                  upcomingPaymentDues.map((inv) => (
                    <Box
                      key={inv.id}
                      component={Link}
                      to={createPageUrl(`InvoiceDetails?id=${inv.id}`)}
                      sx={{
                        p: 1.5,
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: inv.overdue ? 'error.main' : 'divider',
                        bgcolor: inv.overdue ? 'error.light' : 'background.paper',
                        textDecoration: 'none',
                        color: 'inherit',
                        '&:hover': { boxShadow: 2 },
                        transition: 'all 0.15s',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {inv.invoice_number}
                        </Typography>
                        <Chip
                          label={inv.overdue ? 'Overdue' : 'Due'}
                          size="small"
                          color={inv.overdue ? 'error' : 'warning'}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {inv.client_name}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {format(parseISO(inv.due_date), 'MMM d')}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.dark' }}>
                          {getCurrencySymbol(inv.currency || 'USD')}
                          {inv.amount_due?.toFixed(2)}
                        </Typography>
                      </Box>
                    </Box>
                  ))
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ScheduledReportsCard />

      {/* Reports & Analytics */}
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Box sx={{ color: 'secondary.main', display: 'flex' }}>
            <TrendingUp className="w-6 h-6" />
          </Box>
          Reports &amp; Analytics
        </Typography>
        <ReportsSection />
      </Box>
    </Box>
  );
}

function InvoicesTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkSent, setBulkSent] = useState(false);
  const queryClient = useQueryClient();

  const deleteInvoiceMutation = /** @type {any} */ (
    useMutation({
      mutationFn: async (/** @type {any} */ id) => {
        await db.entities.Invoice.delete(id);
      },
      onSuccess: () => {
        showSuccess('Invoice deleted');
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['allInvoices'] });
      },
      onError: (error) => showError('Failed to delete invoice', error.message),
    })
  );

  const deleteAllCancelledMutation = /** @type {any} */ (
    useMutation({
      mutationFn: async () => {
        const cancelled = invoices.filter((i) => i.status === 'cancelled');
        for (const inv of cancelled) {
          await db.entities.Invoice.delete(inv.id);
        }
      },
      onSuccess: () => {
        showSuccess('All cancelled invoices deleted');
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['allInvoices'] });
      },
      onError: (error) => showError('Failed to delete cancelled invoices', error.message),
    })
  );

  const { data: invoices = /** @type {any} */ ([]), isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['invoices'],
      queryFn: () => db.entities.Invoice.list('-issue_date'),
    })
  );

  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clients'],
      queryFn: () => db.entities.Client.list(),
    })
  );

  const getClientName = (clientId) => {
    const client = clients.find((c) => c.id === clientId);
    return client?.name || 'Unknown Client';
  };

  const getActualStatus = (invoice) => {
    if (invoice.status === 'sent' && isPast(new Date(invoice.due_date))) {
      return 'overdue';
    }
    return invoice.status;
  };

  const filteredInvoices = invoices
    .filter((inv) => {
      const clientName = getClientName(inv.client_id);
      return (
        searchTerm === '' ||
        inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    })
    .filter((inv) => (statusFilter === 'all' ? inv.status !== 'cancelled' : getActualStatus(inv) === statusFilter));

  const totalRevenue = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.total_amount, 0);
  const totalOutstanding = invoices
    .filter((i) => i.status === 'sent' || getActualStatus(i) === 'overdue')
    .reduce((sum, i) => sum + i.amount_due, 0);
  const overdueInvoices = invoices.filter((i) => getActualStatus(i) === 'overdue');
  const overdueCount = overdueInvoices.length;

  const sendBulkReminders = async () => {
    setSendingBulk(true);
    for (const inv of overdueInvoices) {
      const client = clients.find((c) => c.id === inv.client_id);
      if (client?.email) {
        await db.integrations.Core.SendEmail({
          to: client.email,
          subject: `[OVERDUE] Payment Reminder – Invoice ${inv.invoice_number}`,
          body: `Dear ${client.name},\n\nThis is a reminder that invoice ${inv.invoice_number} for ${getCurrencySymbol(inv.currency || 'USD')}${inv.amount_due?.toFixed(2)} is overdue (was due ${format(new Date(inv.due_date), 'MMM d, yyyy')}).\n\nPlease arrange payment as soon as possible.\n\nThank you,\nTravelPro`,
        });
      }
    }
    setSendingBulk(false);
    setBulkSent(true);
    setTimeout(() => setBulkSent(false), 3000);
  };

  if (isLoading) {
    return <SkeletonStats />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {overdueCount > 0 && (
          <Button
            onClick={sendBulkReminders}
            disabled={sendingBulk || bulkSent}
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
          >
            {bulkSent ? (
              <>
                <Bell className="w-4 h-4 mr-2" />
                Reminders Sent!
              </>
            ) : sendingBulk ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 mr-2" />
                Send {overdueCount} Overdue Reminder{overdueCount > 1 ? 's' : ''}
              </>
            )}
          </Button>
        )}
        <Link to={createPageUrl('CreateInvoice')}>
          <Button>
            <Plus className="w-5 h-5 mr-2" />
            New Invoice
          </Button>
        </Link>
      </Box>

      {/* Stats */}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Total Revenue"
            color="success"
            icon={<DollarSign className="w-5 h-5" />}
            value={`$${totalRevenue.toFixed(2)}`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Outstanding"
            color="warning"
            icon={<DollarSign className="w-5 h-5" />}
            value={`$${totalOutstanding.toFixed(2)}`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label="Overdue" color="error" icon={<AlertCircle className="w-5 h-5" />} value={overdueCount} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Total Invoices"
            color="primary"
            icon={<FileText className="w-5 h-5" />}
            value={invoices.length}
          />
        </Grid>
      </Grid>

      {/* Search and Filter */}
      <Card>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                placeholder="Search by invoice number or client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {['all', 'draft', 'sent', 'paid', 'overdue', 'cancelled'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
              {statusFilter === 'cancelled' && invoices.filter((i) => i.status === 'cancelled').length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (
                      confirm(
                        `Permanently delete all ${invoices.filter((i) => i.status === 'cancelled').length} cancelled invoices? This cannot be undone.`,
                      )
                    ) {
                      deleteAllCancelledMutation.mutate();
                    }
                  }}
                  disabled={deleteAllCancelledMutation.isPending}
                >
                  {deleteAllCancelledMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-1" />
                  )}
                  Delete All Cancelled
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      {filteredInvoices.length === 0 ? (
        <Card>
          <CardContent sx={{ p: 6, textAlign: 'center' }}>
            <Box
              sx={{
                bgcolor: 'primary.light',
                width: 64,
                height: 64,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
                color: 'primary.main',
              }}
            >
              <FileText className="w-8 h-8" />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              {searchTerm || statusFilter !== 'all' ? 'No invoices found' : 'No invoices yet'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first invoice'}
            </Typography>
            {!searchTerm && statusFilter === 'all' && (
              <Link to={createPageUrl('CreateInvoice')}>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Invoice
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredInvoices.map((invoice) => {
            const actualStatus = getActualStatus(invoice);
            return (
              <Card key={invoice.id} sx={{ '&:hover': { boxShadow: 4 }, transition: 'all 0.2s' }}>
                <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box
                      component={Link}
                      to={createPageUrl(`InvoiceDetails?id=${invoice.id}`)}
                      sx={{ flex: 1, textDecoration: 'none', color: 'inherit' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {invoice.invoice_number}
                        </Typography>
                        <Chip
                          label={actualStatus}
                          size="small"
                          color={INVOICE_STATUS_CHIP[actualStatus] || 'default'}
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {getClientName(invoice.client_id)}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'text.secondary' }}>
                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Calendar className="w-4 h-4" />
                          Issued: {format(new Date(invoice.issue_date), 'MMM d, yyyy')}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Calendar className="w-4 h-4" />
                          Due: {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, ml: 2 }}>
                      {(actualStatus === 'overdue' || actualStatus === 'sent') && (
                        <PaymentReminderButton
                          invoice={invoice}
                          client={clients.find((c) => c.id === invoice.client_id)}
                          variant="icon"
                        />
                      )}
                      {actualStatus === 'cancelled' && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete invoice ${invoice.invoice_number} permanently?`)) {
                              deleteInvoiceMutation.mutate(invoice.id);
                            }
                          }}
                          className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"
                          title="Delete invoice permanently"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.dark', mb: 0.5 }}>
                          {getCurrencySymbol(invoice.currency || 'USD')}
                          {invoice.total_amount.toFixed(2)}
                        </Typography>
                        {invoice.amount_due > 0 && (
                          <Typography variant="caption" color="warning.main">
                            Due: {getCurrencySymbol(invoice.currency || 'USD')}
                            {invoice.amount_due.toFixed(2)}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function MultiCurrencyTab() {
  const theme = useTheme();
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [rates, setRates] = useState(/** @type {any} */ ({}));
  const { exportCSV } = useExport();

  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['allTripsMulti'],
      queryFn: () => db.entities.Trip.list(),
    })
  );

  const { data: invoices = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['allInvoicesMulti'],
      queryFn: () => db.entities.Invoice.list(),
    })
  );

  React.useEffect(() => {
    const fetchRates = async () => {
      try {
        const data = await db.integrations.Core.GetExchangeRate(baseCurrency);
        setRates(data?.rates || {});
      } catch {
        setRates({});
      }
    };
    fetchRates();
  }, [baseCurrency]);

  const currencies = [
    ...new Set([
      ...trips.map((t) => t.acquiring_currency || 'USD'),
      ...trips.map((t) => t.selling_currency || 'USD'),
      ...invoices.map((i) => i.currency || 'USD'),
    ]),
  ].filter(Boolean);

  const convert = (amount, from) => {
    if (!amount || !rates[from]) return 0;
    return amount / rates[from];
  };

  const totalRevenueBase = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + convert(i.total_amount, i.currency || 'USD'), 0);

  const byCurrency = currencies
    .map((curr) => {
      const total = invoices
        .filter((i) => i.status === 'paid' && (i.currency || 'USD') === curr)
        .reduce((sum, i) => sum + i.total_amount, 0);
      const converted = convert(total, curr);
      return { currency: curr, total, converted };
    })
    .filter((c) => c.total > 0);

  const byMonth = [];
  const monthMap = {};
  trips
    .filter((t) => t.start_date)
    .forEach((t) => {
      const m = t.start_date.slice(0, 7);
      if (!monthMap[m]) monthMap[m] = { month: m, inBase: 0, rawTotal: 0 };
      const curr = t.acquiring_currency || 'USD';
      monthMap[m].inBase += convert(t.total_cost || 0, curr);
      monthMap[m].rawTotal += t.total_cost || 0;
    });
  Object.values(monthMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .forEach((d) => byMonth.push(d));

  const handleExport = () => {
    exportCSV(
      byCurrency.map((c) => ({
        currency: c.currency,
        total: c.total,
        [`in_${baseCurrency}`]: c.converted.toFixed(2),
      })),
      `revenue-by-currency-${baseCurrency}`,
      [
        { label: 'Currency', accessor: (d) => d.currency },
        { label: 'Total', accessor: (d) => d.total },
        { label: `In ${baseCurrency}`, accessor: (d) => d[`in_${baseCurrency}`] },
      ],
    );
  };

  // Theme-aware chart colors so charts read correctly in light and dark mode.
  const gridStroke = theme.palette.divider;
  const axisTick = { fill: theme.palette.text.secondary, fontSize: 12 };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Base currency:
          </Typography>
          <select
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground"
          >
            {['USD', 'EUR', 'GBP', 'TRY', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Box>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Total Revenue ({baseCurrency})
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {baseCurrency}{' '}
                {totalRevenueBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Currencies in use
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {currencies.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Base Rate ({baseCurrency})
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {rates[baseCurrency] ? '1.0000' : '—'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                Revenue by Currency
              </Typography>
              {byCurrency.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                  No revenue data
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={byCurrency}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="currency" tick={axisTick} stroke={gridStroke} />
                    <YAxis tick={axisTick} stroke={gridStroke} />
                    <Tooltip
                      formatter={(v) => `${baseCurrency} ${v.toLocaleString()}`}
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 8,
                        color: theme.palette.text.primary,
                      }}
                    />
                    <Bar
                      dataKey="converted"
                      fill={theme.palette.success.main}
                      radius={[4, 4, 0, 0]}
                      name={`In ${baseCurrency}`}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                Monthly Revenue ({baseCurrency})
              </Typography>
              {byMonth.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                  No data
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={byMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="month" tick={axisTick} stroke={gridStroke} />
                    <YAxis tick={axisTick} stroke={gridStroke} />
                    <Tooltip
                      formatter={(v) => `${baseCurrency} ${v.toLocaleString()}`}
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 8,
                        color: theme.palette.text.primary,
                      }}
                    />
                    <Bar
                      dataKey="inBase"
                      fill={theme.palette.primary.main}
                      radius={[4, 4, 0, 0]}
                      name={`In ${baseCurrency}`}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default function Revenue() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Revenue
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Track revenue, manage invoices, and view financial reports.
        </Typography>
      </Box>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="currency">Multi-Currency</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="invoices" className="mt-6">
          <InvoicesTab />
        </TabsContent>
        <TabsContent value="currency" className="mt-6">
          <MultiCurrencyTab />
        </TabsContent>
      </Tabs>
    </Box>
  );
}
