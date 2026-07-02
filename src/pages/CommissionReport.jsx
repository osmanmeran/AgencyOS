import { db } from '@/lib/DbContext';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, TrendingUp, Download } from 'lucide-react';
import { useExport } from '@/hooks/useExport';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function CommissionReport() {
  const { exportCSV } = useExport();

  const { data: report = /** @type {any} */ ({}) } = /** @type {any} */ (useQuery({
    queryKey: ['commissionReport'],
    queryFn: () => db.reports.commissions(),
  }));

  const {
    totalCommission = 0,
    totalProfit = 0,
    totalRevenue = 0,
    avgCommissionRate = 0,
    byAgent = [],
    trips: commissions = [],
  } = report;

  const handleExport = () => {
    exportCSV(commissions.map(t => ({
      trip: t.name,
      client: t.client_name,
      destination: t.destination,
      revenue: t.final_price || 0,
      profit: t.profit,
      commissionRate: `${(t.commissionRate * 100).toFixed(1)}%`,
      commission: t.commission,
      agent: t.agent || '—',
    })), 'commission-report', [
      { label: 'Trip', accessor: d => d.trip },
      { label: 'Client', accessor: d => d.client },
      { label: 'Destination', accessor: d => d.destination },
      { label: 'Revenue', accessor: d => d.revenue },
      { label: 'Profit', accessor: d => d.profit },
      { label: 'Rate', accessor: d => d.commissionRate },
      { label: 'Commission', accessor: d => d.commission },
      { label: 'Agent', accessor: d => d.agent },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2.5 rounded-xl">
            <DollarSign className="w-6 h-6 text-green-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Commission Report</h1>
            <p className="text-sm text-slate-500">Track agent commissions and profitability</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <DollarSign className="w-4 h-4" /> Total Revenue
          </div>
          <p className="text-2xl font-bold">${(totalRevenue || 0).toLocaleString()}</p>
        </Card>
        <Card className="p-4 bg-white">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <TrendingUp className="w-4 h-4" /> Total Profit
          </div>
          <p className="text-2xl font-bold text-green-600">${(totalProfit || 0).toLocaleString()}</p>
        </Card>
        <Card className="p-4 bg-white">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <DollarSign className="w-4 h-4" /> Total Commission
          </div>
          <p className="text-2xl font-bold text-blue-600">${(totalCommission || 0).toLocaleString()}</p>
        </Card>
        <Card className="p-4 bg-white">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <TrendingUp className="w-4 h-4" /> Avg Rate
          </div>
          <p className="text-2xl font-bold">{(avgCommissionRate * 100).toFixed(1)}%</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4 bg-white">
          <h3 className="font-semibold mb-4">Commission by Agent</h3>
          {byAgent.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No commission data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byAgent}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="commission" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Commission" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4 bg-white">
          <h3 className="font-semibold mb-4">Commission by Agent (Pie)</h3>
          {byAgent.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No commission data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={byAgent} dataKey="commission" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {byAgent.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="bg-white">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-semibold">Trip Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Trip</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Client</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Revenue</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Profit</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Rate</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {commissions.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-sm font-medium">{t.name}</td>
                  <td className="px-4 py-2 text-sm text-slate-600">{t.client_name || '—'}</td>
                  <td className="px-4 py-2 text-sm">${(t.final_price || 0).toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-green-600">${t.profit.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm">{(t.commissionRate * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2 text-sm font-medium text-blue-600">${t.commission.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
