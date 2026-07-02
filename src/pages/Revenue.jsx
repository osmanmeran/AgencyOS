import { db } from '@/lib/DbContext';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkeletonStats } from '@/components/ui/skeletons';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format, parseISO, isPast } from 'date-fns';
import { DollarSign, AlertCircle, FileText, TrendingUp, ArrowRight, Plus, Search, Calendar, Bell, Loader2, Trash2, Download } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import ReportsSection from '../components/reports/ReportsSection';
import PaymentReminderButton from '../components/invoices/PaymentReminderButton';
import { useExport } from '@/hooks/useExport';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const INVOICE_STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-800'
};

function OverviewTab() {
  const { data: overview = /** @type {any} */ ({}) } = /** @type {any} */ (useQuery({
    queryKey: ['revenueOverview'],
    queryFn: () => db.reports.revenueOverview(),
  }));

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
    <div className="space-y-8">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Total Revenue</div>
            <DollarSign className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">${totalRevenue.toFixed(0)}</div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Outstanding</div>
            <AlertCircle className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">${totalOutstanding.toFixed(0)}</div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Pending Proposals</div>
            <FileText className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{pendingProposals}</div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Accept Rate</div>
            <TrendingUp className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{proposalAcceptRate}%</div>
        </Card>
      </div>

      {/* Monthly Confirmed Revenue + Payment Dues */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-white shadow-md border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-700">Confirmed Revenue</h2>
            <div className="bg-green-100 p-2 rounded-lg"><DollarSign className="w-4 h-4 text-green-600" /></div>
          </div>
          <div className="text-3xl font-bold text-green-700 mb-1">${monthlyConfirmedRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          <p className="text-xs text-slate-400">From {monthlyConfirmedCount} confirmed reservation{monthlyConfirmedCount !== 1 ? 's' : ''} this month</p>
          <Link to={createPageUrl('Reservations')} className="mt-3 text-xs text-green-600 hover:underline flex items-center gap-1">
            View confirmed <ArrowRight className="w-3 h-3" />
          </Link>
        </Card>
        <Card className="md:col-span-2 p-6 bg-white shadow-md">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-orange-600" />
            Upcoming Payment Dues
          </h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {upcomingPaymentDues.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No upcoming payments</p>
            ) : (
              upcomingPaymentDues.map(inv => (
                <Link key={inv.id} to={createPageUrl(`InvoiceDetails?id=${inv.id}`)}>
                  <div className={`p-3 rounded-lg border ${inv.overdue ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'} hover:shadow-md transition-shadow`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-slate-900">{inv.invoice_number}</span>
                      <Badge className={inv.overdue ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}>
                        {inv.overdue ? 'Overdue' : 'Due'}
                      </Badge>
                    </div>
                    <div className="text-sm text-slate-600">{inv.client_name}</div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-slate-500">{format(parseISO(inv.due_date), 'MMM d')}</span>
                      <span className="font-bold text-green-700">${inv.amount_due?.toFixed(2)}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Reports & Analytics */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-purple-600" />
          Reports & Analytics
        </h2>
        <ReportsSection />
      </div>
    </div>
  );
}

function InvoicesTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkSent, setBulkSent] = useState(false);
  const queryClient = useQueryClient();

  const deleteInvoiceMutation = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ id) => {
      await db.entities.Invoice.delete(id);
    },
    onSuccess: () => {
      showSuccess('Invoice deleted');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['allInvoices'] });
    },
    onError: (error) => showError('Failed to delete invoice', error.message)
  }));

  const deleteAllCancelledMutation = /** @type {any} */ (useMutation({
    mutationFn: async () => {
      const cancelled = invoices.filter(i => i.status === 'cancelled');
      for (const inv of cancelled) {
        await db.entities.Invoice.delete(inv.id);
      }
    },
    onSuccess: () => {
      showSuccess('All cancelled invoices deleted');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['allInvoices'] });
    },
    onError: (error) => showError('Failed to delete cancelled invoices', error.message)
  }));

  const { data: invoices = /** @type {any} */ ([]), isLoading } = /** @type {any} */ (useQuery({
    queryKey: ['invoices'],
    queryFn: () => db.entities.Invoice.list('-issue_date')
  }));

  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['clients'],
    queryFn: () => db.entities.Client.list()
  }));

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Unknown Client';
  };

  const getActualStatus = (invoice) => {
    if (invoice.status === 'sent' && isPast(new Date(invoice.due_date))) {
      return 'overdue';
    }
    return invoice.status;
  };

  const filteredInvoices = invoices
    .filter(inv => {
      const clientName = getClientName(inv.client_id);
      return searchTerm === '' ||
        inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientName.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .filter(inv => statusFilter === 'all' ? inv.status !== 'cancelled' : getActualStatus(inv) === statusFilter);

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total_amount, 0);
  const totalOutstanding = invoices.filter(i => i.status === 'sent' || getActualStatus(i) === 'overdue').reduce((sum, i) => sum + i.amount_due, 0);
  const overdueInvoices = invoices.filter(i => getActualStatus(i) === 'overdue');
  const overdueCount = overdueInvoices.length;

  const sendBulkReminders = async () => {
    setSendingBulk(true);
    for (const inv of overdueInvoices) {
      const client = clients.find(c => c.id === inv.client_id);
      if (client?.email) {
        await db.integrations.Core.SendEmail({
          to: client.email,
          subject: `[OVERDUE] Payment Reminder – Invoice ${inv.invoice_number}`,
          body: `Dear ${client.name},\n\nThis is a reminder that invoice ${inv.invoice_number} for $${inv.amount_due?.toFixed(2)} is overdue (was due ${format(new Date(inv.due_date), 'MMM d, yyyy')}).\n\nPlease arrange payment as soon as possible.\n\nThank you,\nTravelPro`,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {overdueCount > 0 && (
            <Button
              onClick={sendBulkReminders}
              disabled={sendingBulk || bulkSent}
              variant="outline"
              className="border-red-400 text-red-600 hover:bg-red-50"
            >
              {bulkSent ? (
                <><Bell className="w-4 h-4 mr-2" />Reminders Sent!</>
              ) : sendingBulk ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
              ) : (
                <><Bell className="w-4 h-4 mr-2" />Send {overdueCount} Overdue Reminder{overdueCount > 1 ? 's' : ''}</>
              )}
            </Button>
          )}
          <Link to={createPageUrl('CreateInvoice')}>
            <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg">
              <Plus className="w-5 h-5 mr-2" />
              New Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Total Revenue</div>
            <DollarSign className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">${totalRevenue.toFixed(2)}</div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Outstanding</div>
            <DollarSign className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">${totalOutstanding.toFixed(2)}</div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-red-500 to-red-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Overdue</div>
            <AlertCircle className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{overdueCount}</div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Total Invoices</div>
            <FileText className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{invoices.length}</div>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card className="p-4 bg-white shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder="Search by invoice number or client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', 'draft', 'sent', 'paid', 'overdue', 'cancelled'].map(status => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={statusFilter === status ? 'bg-blue-600' : ''}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
            {statusFilter === 'cancelled' && invoices.filter(i => i.status === 'cancelled').length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm(`Permanently delete all ${invoices.filter(i => i.status === 'cancelled').length} cancelled invoices? This cannot be undone.`)) {
                    deleteAllCancelledMutation.mutate();
                  }
                }}
                disabled={deleteAllCancelledMutation.isPending}
              >
                {deleteAllCancelledMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                Delete All Cancelled
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Invoices List */}
      {filteredInvoices.length === 0 ? (
        <Card className="p-12 text-center bg-white">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            {searchTerm || statusFilter !== 'all' ? 'No invoices found' : 'No invoices yet'}
          </h3>
          <p className="text-slate-600 mb-6">
            {searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first invoice'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <Link to={createPageUrl('CreateInvoice')}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Create Invoice
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredInvoices.map(invoice => {
            const actualStatus = getActualStatus(invoice);
            return (
              <Card key={invoice.id} className="p-6 bg-white hover:shadow-xl transition-all">
                <div className="flex justify-between items-start">
                  <Link to={createPageUrl(`InvoiceDetails?id=${invoice.id}`)} className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-slate-900">{invoice.invoice_number}</h3>
                      <Badge className={INVOICE_STATUS_COLORS[actualStatus]}>
                        {actualStatus}
                      </Badge>
                    </div>
                    <div className="text-slate-600 mb-2">{getClientName(invoice.client_id)}</div>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Issued: {format(new Date(invoice.issue_date), 'MMM d, yyyy')}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Due: {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-start gap-3 ml-4">
                    {(actualStatus === 'overdue' || actualStatus === 'sent') && (
                      <PaymentReminderButton
                        invoice={invoice}
                        client={clients.find(c => c.id === invoice.client_id)}
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
                        className="p-1.5 rounded hover:bg-red-100 text-red-500 transition-colors"
                        title="Delete invoice permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-700 mb-1">
                        ${invoice.total_amount.toFixed(2)}
                      </div>
                      {invoice.amount_due > 0 && (
                        <div className="text-sm text-orange-600">
                          Due: ${invoice.amount_due.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MultiCurrencyTab() {
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [rates, setRates] = useState(/** @type {any} */ ({}));
  const { exportCSV } = useExport();

  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['allTripsMulti'],
    queryFn: () => db.entities.Trip.list(),
  }));

  const { data: invoices = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['allInvoicesMulti'],
    queryFn: () => db.entities.Invoice.list(),
  }));

  React.useEffect(() => {
    const fetchRates = async () => {
      try {
        const data = await db.integrations.Core.GetExchangeRate(baseCurrency);
        setRates(data?.rates || {});
      } catch { setRates({}); }
    };
    fetchRates();
  }, [baseCurrency]);

  const currencies = [...new Set([
    ...trips.map(t => t.acquiring_currency || 'USD'),
    ...trips.map(t => t.selling_currency || 'USD'),
    ...invoices.map(i => i.currency || 'USD'),
  ])].filter(Boolean);

  const convert = (amount, from) => {
    if (!amount || !rates[from]) return 0;
    return amount / rates[from];
  };

  const totalRevenueBase = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + convert(i.total_amount, i.currency || 'USD'), 0);

  const byCurrency = currencies.map(curr => {
    const total = invoices
      .filter(i => i.status === 'paid' && (i.currency || 'USD') === curr)
      .reduce((sum, i) => sum + i.total_amount, 0);
    const converted = convert(total, curr);
    return { currency: curr, total, converted };
  }).filter(c => c.total > 0);

  const byMonth = [];
  const monthMap = {};
  trips.filter(t => t.start_date).forEach(t => {
    const m = t.start_date.slice(0, 7);
    if (!monthMap[m]) monthMap[m] = { month: m, inBase: 0, rawTotal: 0 };
    const curr = t.acquiring_currency || 'USD';
    monthMap[m].inBase += convert(t.total_cost || 0, curr);
    monthMap[m].rawTotal += t.total_cost || 0;
  });
  Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)).forEach(d => byMonth.push(d));

  const handleExport = () => {
    exportCSV(byCurrency.map(c => ({
      currency: c.currency,
      total: c.total,
      [`in_${baseCurrency}`]: c.converted.toFixed(2),
    })), `revenue-by-currency-${baseCurrency}`, [
      { label: 'Currency', accessor: d => d.currency },
      { label: 'Total', accessor: d => d.total },
      { label: `In ${baseCurrency}`, accessor: d => d[`in_${baseCurrency}`] },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">Base currency:</label>
          <select value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white"
          >
            {['USD', 'EUR', 'GBP', 'TRY', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white">
          <p className="text-sm text-slate-500 mb-1">Total Revenue ({baseCurrency})</p>
          <p className="text-2xl font-bold">{baseCurrency} {totalRevenueBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </Card>
        <Card className="p-4 bg-white">
          <p className="text-sm text-slate-500 mb-1">Currencies in use</p>
          <p className="text-2xl font-bold">{currencies.length}</p>
        </Card>
        <Card className="p-4 bg-white">
          <p className="text-sm text-slate-500 mb-1">Base Rate ({baseCurrency})</p>
          <p className="text-2xl font-bold">{rates[baseCurrency] ? '1.0000' : '—'}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4 bg-white">
          <h3 className="font-semibold mb-4">Revenue by Currency</h3>
          {byCurrency.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No revenue data</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byCurrency}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="currency" />
                <YAxis />
                <Tooltip formatter={(v) => `${baseCurrency} ${v.toLocaleString()}`} />
                <Bar dataKey="converted" fill="#10b981" radius={[4, 4, 0, 0]} name={`In ${baseCurrency}`} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4 bg-white">
          <h3 className="font-semibold mb-4">Monthly Revenue ({baseCurrency})</h3>
          {byMonth.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip formatter={(v) => `${baseCurrency} ${v.toLocaleString()}`} />
                <Bar dataKey="inBase" fill="#3b82f6" radius={[4, 4, 0, 0]} name={`In ${baseCurrency}`} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function Revenue() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Revenue</h1>
        <p className="text-slate-600">Track revenue, manage invoices, and view financial reports.</p>
      </div>

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
    </div>
  );
}
