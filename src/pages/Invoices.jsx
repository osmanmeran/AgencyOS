const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useExport } from '@/hooks/useExport';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, FileText, Search, Calendar, DollarSign, AlertCircle, Bell, Loader2, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format, isPast } from 'date-fns';
import { SkeletonTable } from '@/components/ui/skeletons';
import PaymentReminderButton from '../components/invoices/PaymentReminderButton';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-800'
};

export default function Invoices() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkSent, setBulkSent] = useState(false);
  const { exportCSV } = useExport();

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
    .filter(inv => statusFilter === 'all' || getActualStatus(inv) === statusFilter);

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
    return <SkeletonTable />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Invoices</h1>
          <p className="text-slate-600">Create and manage client invoices</p>
        </div>
        <div className="flex gap-2">
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
          <Button variant="outline" onClick={() => exportCSV(filteredInvoices, 'invoices', [
            { label: 'Invoice Number', accessor: (inv) => inv.invoice_number },
            { label: 'Client Name', accessor: (inv) => getClientName(inv.client_id) },
            { label: 'Total Amount', accessor: (inv) => inv.total_amount },
            { label: 'Amount Due', accessor: (inv) => inv.amount_due },
            { label: 'Status', accessor: (inv) => getActualStatus(inv) },
            { label: 'Issue Date', accessor: (inv) => inv.issue_date },
            { label: 'Due Date', accessor: (inv) => inv.due_date }
          ])}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
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
          <div className="flex gap-2">
            {['all', 'draft', 'sent', 'paid', 'overdue'].map(status => (
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
                      <Badge className={STATUS_COLORS[actualStatus]}>
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