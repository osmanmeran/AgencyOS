const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SkeletonTable } from '@/components/ui/skeletons';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format, parseISO, isBefore } from 'date-fns';
import { FileText, Calendar, CheckCircle } from 'lucide-react';

export default function ClientInvoices() {
  const { data: user } = /** @type {any} */ (useQuery({
    queryKey: ['currentUser'],
    queryFn: () => db.auth.me()
  }));

  const { data: client } = /** @type {any} */ (useQuery({
    queryKey: ['myClient', user?.email],
    queryFn: async () => {
      const clients = await db.entities.Client.filter({ email: user.email });
      return clients[0];
    },
    enabled: !!user?.email
  }));

  const { data: invoices = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['clientInvoices', client?.id],
    queryFn: () => db.entities.Invoice.filter({ client_id: client.id }),
    enabled: !!client?.id
  }));

  if (!client) {
    return <SkeletonTable />;
  }

  const sortedInvoices = [...invoices].sort((a, b) => +(new Date(b.issue_date)) - +(new Date(a.issue_date)));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">My Invoices</h1>
        <p className="text-slate-600">View and manage your invoices</p>
      </div>

      {sortedInvoices.length === 0 ? (
        <Card className="p-12 text-center bg-white">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No invoices yet</h3>
          <p className="text-slate-600">Your invoices will appear here</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedInvoices.map(invoice => {
            const isOverdue = invoice.status !== 'paid' && isBefore(parseISO(invoice.due_date), new Date());
            const isPaid = invoice.status === 'paid';
            
            return (
              <Link key={invoice.id} to={createPageUrl(`ClientInvoiceDetails?id=${invoice.id}`)}>
                <Card className={`p-6 bg-white hover:shadow-xl transition-all cursor-pointer ${isOverdue ? 'border-red-200' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-slate-900">{invoice.invoice_number}</h3>
                        <Badge className={
                          isPaid ? 'bg-green-100 text-green-800' : 
                          isOverdue ? 'bg-red-100 text-red-800' : 
                          'bg-orange-100 text-orange-800'
                        }>
                          {isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Pending'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Issued: {format(parseISO(invoice.issue_date), 'MMM d, yyyy')}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Due: {format(parseISO(invoice.due_date), 'MMM d, yyyy')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-700 mb-1">
                        ${invoice.total_amount.toFixed(2)}
                      </div>
                      {!isPaid && invoice.amount_due > 0 && (
                        <div className="text-sm text-orange-600">
                          Due: ${invoice.amount_due.toFixed(2)}
                        </div>
                      )}
                      {isPaid && (
                        <div className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          Paid in full
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}