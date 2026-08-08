import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@mui/material/styles';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { DollarSign, TrendingUp, Plane, CheckCircle, Download, Search, Calendar } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

// Theme-aware accent colors (via CSS variables) used for card borders and
// metric values so they stay legible in both light and dark mode.
const ACCENT = {
  green: 'hsl(var(--chart-2))',
  blue: 'hsl(var(--chart-1))',
  amber: 'hsl(var(--chart-4))',
  red: 'hsl(var(--destructive))',
  purple: 'hsl(var(--chart-3))',
};

/** Muted summary stat card with a colored left border (matches Dashboard). */
function StatCard({ label, value, icon, accent }) {
  return (
    <Card className="p-4 border-l-4" style={{ borderLeftColor: accent }}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm text-muted-foreground">{label}</div>
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
    </Card>
  );
}

/** Small labelled metric tile used inside the Proposals/Reservations tabs. */
function MetricTile({ label, value, accent = undefined }) {
  return (
    <div className="p-3 bg-muted rounded-lg">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-xl font-bold text-foreground" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  );
}

export default function ReportsSection() {
  const theme = useTheme();
  const gridStroke = theme.palette.divider;
  const axisTick = { fill: theme.palette.text.secondary, fontSize: 12 };
  const tooltipStyle = {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    color: theme.palette.text.primary,
  };
  const [timeRange, setTimeRange] = useState('6');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: invoices = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['reportInvoices'],
      queryFn: () => db.entities.Invoice.list(),
    })
  );

  const { data: payments = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['reportPayments'],
      queryFn: () => db.entities.ClientPayment.list(),
    })
  );

  const { data: proposals = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['reportProposals'],
      queryFn: () => db.entities.Proposal.list(),
    })
  );

  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['reportTrips'],
      queryFn: () => db.entities.Trip.list(),
    })
  );

  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['reportClients'],
      queryFn: () => db.entities.Client.list(),
    })
  );

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['reportSuppliers'],
      queryFn: () => db.entities.Supplier.list(),
    })
  );

  const { data: services = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['reportServices'],
      queryFn: () => db.entities.SupplierService.list(),
    })
  );

  // Filter data based on search and date range
  /* getDateRange and dateRange removed (unused) */

  // Generate monthly revenue data
  const months = parseInt(timeRange);
  const revenueByMonth = [];
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = subMonths(new Date(), i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    const monthPayments = payments.filter((p) => {
      if (!p.payment_date) return false;
      const paymentDate = parseISO(p.payment_date);
      return isWithinInterval(paymentDate, { start: monthStart, end: monthEnd }) && p.status === 'completed';
    });

    const monthInvoices = invoices.filter((inv) => {
      if (!inv.issue_date) return false;
      const issueDate = parseISO(inv.issue_date);
      return isWithinInterval(issueDate, { start: monthStart, end: monthEnd });
    });

    revenueByMonth.push({
      month: format(monthDate, 'MMM'),
      revenue: monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
      invoiced: monthInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0),
    });
  }

  // Filter clients by search
  const filteredClients = clients.filter(
    (c) => !searchTerm || c.name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Revenue by client
  const revenueByClient = filteredClients
    .map((client) => {
      const clientPayments = payments.filter((p) => p.client_id === client.id && p.status === 'completed');
      return {
        name: client.name,
        revenue: clientPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
      };
    })
    .filter((c) => c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 7);

  // Outstanding balances
  const outstandingByClient = filteredClients
    .map((client) => {
      const clientInvoices = invoices.filter(
        (i) => i.client_id === client.id && i.status !== 'paid' && i.status !== 'cancelled',
      );
      return {
        name: client.name,
        outstanding: clientInvoices.reduce((sum, i) => sum + (i.amount_due || 0), 0),
      };
    })
    .filter((c) => c.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  // Proposal stats
  const proposalStats = [
    { name: 'Accepted', value: proposals.filter((p) => p.status === 'accepted').length, color: '#10b981' },
    { name: 'Pending', value: proposals.filter((p) => p.status === 'sent').length, color: '#3b82f6' },
    { name: 'Rejected', value: proposals.filter((p) => p.status === 'rejected').length, color: '#ef4444' },
    { name: 'Draft', value: proposals.filter((p) => p.status === 'draft').length, color: '#6b7280' },
  ].filter((s) => s.value > 0);

  // Trip popularity
  const tripsByDestination = trips.reduce((acc, trip) => {
    const dest = trip.destination || 'Unknown';
    acc[dest] = (acc[dest] || 0) + 1;
    return acc;
  }, {});
  const destinationData = Object.entries(tripsByDestination)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Supplier costs
  const supplierCosts = suppliers
    .map((supplier) => {
      const supplierServices = services.filter((s) => s.supplier_id === supplier.id);
      const totalBudgeted = supplierServices.reduce((sum, s) => sum + (s.budgeted_cost || 0), 0);
      const totalActual = supplierServices.reduce((sum, s) => sum + (s.actual_cost || 0), 0);
      return {
        name: supplier.name,
        budgeted: totalBudgeted,
        actual: totalActual,
        variance: totalBudgeted - totalActual,
      };
    })
    .filter((s) => s.budgeted > 0 || s.actual > 0);

  // Summary stats
  const totalRevenue = payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalOutstanding = invoices
    .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
    .reduce((sum, i) => sum + (i.amount_due || 0), 0);
  const acceptanceRate =
    proposals.length > 0
      ? Math.round((proposals.filter((p) => p.status === 'accepted').length / proposals.length) * 100)
      : 0;
  const avgTripValue = trips.length > 0 ? totalRevenue / trips.length : 0;

  // Export to XLS
  const exportToXLS = (dataType) => {
    let data = [];
    let filename = '';

    switch (dataType) {
      case 'revenue':
        data = revenueByMonth.map((r) => ({ Month: r.month, Revenue: r.revenue, Invoiced: r.invoiced }));
        filename = 'revenue_report';
        break;
      case 'clients':
        data = revenueByClient.map((c) => ({ Client: c.name, Revenue: c.revenue }));
        filename = 'client_revenue_report';
        break;
      case 'outstanding':
        data = outstandingByClient.map((c) => ({ Client: c.name, Outstanding: c.outstanding }));
        filename = 'outstanding_balances_report';
        break;
      case 'trips':
        data = trips.map((t) => ({
          Name: t.name,
          Destination: t.destination,
          StartDate: t.start_date,
          EndDate: t.end_date,
          Status: t.status,
          Reference: t.reference_number || '',
        }));
        filename = 'trips_report';
        break;
      case 'suppliers':
        data = supplierCosts.map((s) => ({
          Supplier: s.name,
          Budgeted: s.budgeted,
          Actual: s.actual,
          Variance: s.variance,
        }));
        filename = 'supplier_costs_report';
        break;
      default:
        return;
    }

    // Convert to CSV (XLS compatible)
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [headers.join('\t'), ...data.map((row) => headers.map((h) => row[h] ?? '').join('\t'))].join(
      '\n',
    );

    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48"
            />
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Last 3 months</SelectItem>
              <SelectItem value="6">Last 6 months</SelectItem>
              <SelectItem value="12">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          {/* The two date inputs plus the "to" separator exceed a phone's width;
              without flex-wrap here the end-date input runs off the card edge. */}
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="w-36"
              placeholder="Start date"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="w-36"
              placeholder="End date"
            />
          </div>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          accent={ACCENT.green}
          icon={<DollarSign className="w-4 h-4" />}
          value={`$${totalRevenue.toFixed(0)}`}
        />
        <StatCard
          label="Outstanding"
          accent={ACCENT.amber}
          icon={<TrendingUp className="w-4 h-4" />}
          value={`$${totalOutstanding.toFixed(0)}`}
        />
        <StatCard
          label="Acceptance Rate"
          accent={ACCENT.blue}
          icon={<CheckCircle className="w-4 h-4" />}
          value={`${acceptanceRate}%`}
        />
        <StatCard
          label="Avg Reservation Value"
          accent={ACCENT.purple}
          icon={<Plane className="w-4 h-4" />}
          value={`$${avgTripValue.toFixed(0)}`}
        />
      </div>

      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-foreground">Revenue vs Invoiced</h3>
                <Button size="sm" variant="outline" onClick={() => exportToXLS('revenue')}>
                  <Download className="w-4 h-4 mr-1" /> XLS
                </Button>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="month" tick={axisTick} stroke={gridStroke} />
                  <YAxis tick={axisTick} stroke={gridStroke} />
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(0)}`} contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="invoiced" name="Invoiced" fill="#3b82f6" />
                  <Bar dataKey="revenue" name="Collected" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-foreground">Revenue by Client</h3>
                <Button size="sm" variant="outline" onClick={() => exportToXLS('clients')}>
                  <Download className="w-4 h-4 mr-1" /> XLS
                </Button>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueByClient} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis type="number" tick={axisTick} stroke={gridStroke} />
                  <YAxis dataKey="name" type="category" width={80} tick={axisTick} stroke={gridStroke} />
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(0)}`} contentStyle={tooltipStyle} />
                  <Bar dataKey="revenue" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-foreground">Outstanding Balances</h3>
                <Button size="sm" variant="outline" onClick={() => exportToXLS('outstanding')}>
                  <Download className="w-4 h-4 mr-1" /> XLS
                </Button>
              </div>
              {outstandingByClient.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No outstanding balances</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={outstandingByClient.slice(0, 7)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis type="number" tick={axisTick} stroke={gridStroke} />
                    <YAxis dataKey="name" type="category" width={80} tick={axisTick} stroke={gridStroke} />
                    <Tooltip formatter={(value) => `$${Number(value).toFixed(0)}`} contentStyle={tooltipStyle} />
                    <Bar dataKey="outstanding" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="font-bold text-foreground mb-4">Payment History</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="month" tick={axisTick} stroke={gridStroke} />
                  <YAxis tick={axisTick} stroke={gridStroke} />
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(0)}`} contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="proposals">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-bold text-foreground mb-4">Proposal Status</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={proposalStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {proposalStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4">
              <h3 className="font-bold text-foreground mb-4">Proposal Metrics</h3>
              <div className="grid grid-cols-2 gap-3">
                <MetricTile label="Total" value={proposals.length} />
                <MetricTile
                  label="Accepted"
                  accent={ACCENT.green}
                  value={proposals.filter((p) => p.status === 'accepted').length}
                />
                <MetricTile
                  label="Pending"
                  accent={ACCENT.blue}
                  value={proposals.filter((p) => p.status === 'sent').length}
                />
                <MetricTile
                  label="Rejected"
                  accent={ACCENT.red}
                  value={proposals.filter((p) => p.status === 'rejected').length}
                />
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reservations">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-bold text-foreground mb-4">Popular Destinations</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={destinationData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name} (${value})`}
                  >
                    {destinationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-foreground">Reservation Statistics</h3>
                <Button size="sm" variant="outline" onClick={() => exportToXLS('trips')}>
                  <Download className="w-4 h-4 mr-1" /> XLS
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MetricTile label="Total Reservations" value={trips.length} />
                <MetricTile
                  label="Unique Destinations"
                  accent={ACCENT.blue}
                  value={Object.keys(tripsByDestination).length}
                />
                <MetricTile label="Total Clients" accent={ACCENT.green} value={clients.length} />
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-foreground">Supplier Costs &amp; Profitability</h3>
              <Button size="sm" variant="outline" onClick={() => exportToXLS('suppliers')}>
                <Download className="w-4 h-4 mr-1" /> XLS
              </Button>
            </div>
            {supplierCosts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No supplier cost data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={supplierCosts}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="name" tick={axisTick} stroke={gridStroke} />
                  <YAxis tick={axisTick} stroke={gridStroke} />
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(0)}`} contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="budgeted" name="Budgeted" fill="#3b82f6" />
                  <Bar dataKey="actual" name="Actual" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
