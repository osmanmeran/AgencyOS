const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { DollarSign, TrendingUp, Plane, CheckCircle, Download, Search, Calendar } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function ReportsSection() {
  const [timeRange, setTimeRange] = useState('6');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: invoices = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['reportInvoices'],
    queryFn: () => db.entities.Invoice.list()
  }));

  const { data: payments = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['reportPayments'],
    queryFn: () => db.entities.ClientPayment.list()
  }));

  const { data: proposals = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['reportProposals'],
    queryFn: () => db.entities.Proposal.list()
  }));

  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['reportTrips'],
    queryFn: () => db.entities.Trip.list()
  }));

  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['reportClients'],
    queryFn: () => db.entities.Client.list()
  }));

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['reportSuppliers'],
    queryFn: () => db.entities.Supplier.list()
  }));

  const { data: services = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['reportServices'],
    queryFn: () => db.entities.SupplierService.list()
  }));

  // Filter data based on search and date range
  /* getDateRange and dateRange removed (unused) */

  // Generate monthly revenue data
  const months = parseInt(timeRange);
  const revenueByMonth = [];
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = subMonths(new Date(), i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    
    const monthPayments = payments.filter(p => {
      if (!p.payment_date) return false;
      const paymentDate = parseISO(p.payment_date);
      return isWithinInterval(paymentDate, { start: monthStart, end: monthEnd }) && p.status === 'completed';
    });

    const monthInvoices = invoices.filter(inv => {
      if (!inv.issue_date) return false;
      const issueDate = parseISO(inv.issue_date);
      return isWithinInterval(issueDate, { start: monthStart, end: monthEnd });
    });

    revenueByMonth.push({
      month: format(monthDate, 'MMM'),
      revenue: monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
      invoiced: monthInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0)
    });
  }

  // Filter clients by search
  const filteredClients = clients.filter(c => 
    !searchTerm || c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Revenue by client
  const revenueByClient = filteredClients.map(client => {
    const clientPayments = payments.filter(p => p.client_id === client.id && p.status === 'completed');
    return {
      name: client.name,
      revenue: clientPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
    };
  }).filter(c => c.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 7);

  // Outstanding balances
  const outstandingByClient = filteredClients.map(client => {
    const clientInvoices = invoices.filter(i => i.client_id === client.id && i.status !== 'paid' && i.status !== 'cancelled');
    return {
      name: client.name,
      outstanding: clientInvoices.reduce((sum, i) => sum + (i.amount_due || 0), 0)
    };
  }).filter(c => c.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);

  // Proposal stats
  const proposalStats = [
    { name: 'Accepted', value: proposals.filter(p => p.status === 'accepted').length, color: '#10b981' },
    { name: 'Pending', value: proposals.filter(p => p.status === 'sent').length, color: '#3b82f6' },
    { name: 'Rejected', value: proposals.filter(p => p.status === 'rejected').length, color: '#ef4444' },
    { name: 'Draft', value: proposals.filter(p => p.status === 'draft').length, color: '#6b7280' }
  ].filter(s => s.value > 0);

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
  const supplierCosts = suppliers.map(supplier => {
    const supplierServices = services.filter(s => s.supplier_id === supplier.id);
    const totalBudgeted = supplierServices.reduce((sum, s) => sum + (s.budgeted_cost || 0), 0);
    const totalActual = supplierServices.reduce((sum, s) => sum + (s.actual_cost || 0), 0);
    return {
      name: supplier.name,
      budgeted: totalBudgeted,
      actual: totalActual,
      variance: totalBudgeted - totalActual
    };
  }).filter(s => s.budgeted > 0 || s.actual > 0);

  // Summary stats
  const totalRevenue = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalOutstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((sum, i) => sum + (i.amount_due || 0), 0);
  const acceptanceRate = proposals.length > 0 ? Math.round((proposals.filter(p => p.status === 'accepted').length / proposals.length) * 100) : 0;
  const avgTripValue = trips.length > 0 ? totalRevenue / trips.length : 0;

  // Export to XLS
  const exportToXLS = (dataType) => {
    let data = [];
    let filename = '';
    
    switch (dataType) {
      case 'revenue':
        data = revenueByMonth.map(r => ({ Month: r.month, Revenue: r.revenue, Invoiced: r.invoiced }));
        filename = 'revenue_report';
        break;
      case 'clients':
        data = revenueByClient.map(c => ({ Client: c.name, Revenue: c.revenue }));
        filename = 'client_revenue_report';
        break;
      case 'outstanding':
        data = outstandingByClient.map(c => ({ Client: c.name, Outstanding: c.outstanding }));
        filename = 'outstanding_balances_report';
        break;
      case 'trips':
        data = trips.map(t => ({
          Name: t.name,
          Destination: t.destination,
          StartDate: t.start_date,
          EndDate: t.end_date,
          Status: t.status,
          Reference: t.reference_number || ''
        }));
        filename = 'trips_report';
        break;
      case 'suppliers':
        data = supplierCosts.map(s => ({
          Supplier: s.name,
          Budgeted: s.budgeted,
          Actual: s.actual,
          Variance: s.variance
        }));
        filename = 'supplier_costs_report';
        break;
      default:
        return;
    }

    // Convert to CSV (XLS compatible)
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join('\t'),
      ...data.map(row => headers.map(h => row[h] ?? '').join('\t'))
    ].join('\n');
    
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
      <Card className="p-4 bg-white">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
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
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <Input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="w-36"
              placeholder="Start date"
            />
            <span className="text-slate-400">to</span>
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
        <Card className="p-4 bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm opacity-90">Total Revenue</div>
            <DollarSign className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-2xl font-bold">${totalRevenue.toFixed(0)}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm opacity-90">Outstanding</div>
            <TrendingUp className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-2xl font-bold">${totalOutstanding.toFixed(0)}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm opacity-90">Acceptance Rate</div>
            <CheckCircle className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-2xl font-bold">{acceptanceRate}%</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm opacity-90">Avg Reservation Value</div>
            <Plane className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-2xl font-bold">${avgTripValue.toFixed(0)}</div>
        </Card>
      </div>

      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="bg-white border border-slate-200 p-1">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4 bg-white shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-900">Revenue vs Invoiced</h3>
                <Button size="sm" variant="outline" onClick={() => exportToXLS('revenue')}>
                  <Download className="w-4 h-4 mr-1" /> XLS
                </Button>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(0)}`} />
                  <Legend />
                  <Bar dataKey="invoiced" name="Invoiced" fill="#3b82f6" />
                  <Bar dataKey="revenue" name="Collected" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4 bg-white shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-900">Revenue by Client</h3>
                <Button size="sm" variant="outline" onClick={() => exportToXLS('clients')}>
                  <Download className="w-4 h-4 mr-1" /> XLS
                </Button>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueByClient} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(0)}`} />
                  <Bar dataKey="revenue" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4 bg-white shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-900">Outstanding Balances</h3>
                <Button size="sm" variant="outline" onClick={() => exportToXLS('outstanding')}>
                  <Download className="w-4 h-4 mr-1" /> XLS
                </Button>
              </div>
              {outstandingByClient.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No outstanding balances</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={outstandingByClient.slice(0, 7)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} />
                    <Tooltip formatter={(value) => `$${Number(value).toFixed(0)}`} />
                    <Bar dataKey="outstanding" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card className="p-4 bg-white shadow-md">
              <h3 className="font-bold text-slate-900 mb-4">Payment History</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(0)}`} />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="proposals">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4 bg-white shadow-md">
              <h3 className="font-bold text-slate-900 mb-4">Proposal Status</h3>
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
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4 bg-white shadow-md">
              <h3 className="font-bold text-slate-900 mb-4">Proposal Metrics</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-sm text-slate-600">Total</div>
                  <div className="text-xl font-bold text-slate-900">{proposals.length}</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-600">Accepted</div>
                  <div className="text-xl font-bold text-green-700">{proposals.filter(p => p.status === 'accepted').length}</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-600">Pending</div>
                  <div className="text-xl font-bold text-blue-700">{proposals.filter(p => p.status === 'sent').length}</div>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <div className="text-sm text-red-600">Rejected</div>
                  <div className="text-xl font-bold text-red-700">{proposals.filter(p => p.status === 'rejected').length}</div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reservations">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4 bg-white shadow-md">
              <h3 className="font-bold text-slate-900 mb-4">Popular Destinations</h3>
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
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4 bg-white shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-900">Reservation Statistics</h3>
                <Button size="sm" variant="outline" onClick={() => exportToXLS('trips')}>
                  <Download className="w-4 h-4 mr-1" /> XLS
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-sm text-slate-600">Total Reservations</div>
                  <div className="text-xl font-bold text-slate-900">{trips.length}</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-600">Unique Destinations</div>
                  <div className="text-xl font-bold text-blue-700">{Object.keys(tripsByDestination).length}</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-600">Total Clients</div>
                  <div className="text-xl font-bold text-green-700">{clients.length}</div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card className="p-4 bg-white shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900">Supplier Costs & Profitability</h3>
              <Button size="sm" variant="outline" onClick={() => exportToXLS('suppliers')}>
                <Download className="w-4 h-4 mr-1" /> XLS
              </Button>
            </div>
            {supplierCosts.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No supplier cost data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={supplierCosts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(0)}`} />
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