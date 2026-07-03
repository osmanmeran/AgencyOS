import { db } from '@/lib/DbContext';

import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonStats } from '@/components/ui/skeletons';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel';
import { FileText, Plane, DollarSign, CheckCircle, CreditCard, ArrowRight, Calendar, AlertCircle, ImageOff, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format, parseISO, isBefore } from 'date-fns';
import { getFeatured } from '@/lib/b2bApi';

export default function ClientPortal() {
  const [user, setUser] = React.useState(null);
  const [client, setClient] = React.useState(null);

  React.useEffect(() => {
    db.auth.me().then(async (currentUser) => {
      setUser(currentUser);
      // Prefer the authoritative client_id from the JWT — email matching
      // alone silently fails whenever the portal login email differs from
      // the CRM contact's email (a completely normal setup).
      let resolved = null;
      if (currentUser.client_id) {
        resolved = await db.entities.Client.get(currentUser.client_id).catch(() => null);
      }
      if (!resolved && currentUser.email) {
        const clients = await db.entities.Client.filter({ email: currentUser.email });
        resolved = clients[0] || null;
      }
      if (resolved) setClient(resolved);
    });
  }, []);

  const { data: proposals = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['myProposals', client?.id],
    queryFn: () => db.entities.Proposal.filter({ client_id: client.id }),
    enabled: !!client
  }));

  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['myTrips', client?.id],
    queryFn: () => db.entities.Trip.filter({ client_id: client.id }),
    enabled: !!client
  }));

  const { data: payments = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['myPayments', client?.id],
    queryFn: () => db.entities.ClientPayment.filter({ client_id: client.id }),
    enabled: !!client
  }));

  const { data: invoices = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['myInvoices', client?.id],
    queryFn: () => db.entities.Invoice.filter({ client_id: client.id }),
    enabled: !!client
  }));

  const { data: featuredData } = /** @type {any} */ (useQuery({
    queryKey: ['b2bFeatured'],
    queryFn: getFeatured,
    enabled: !!client
  }));
  const featuredItems = featuredData?.items || [];

  const pendingInvoices = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled');
  const overdueInvoices = pendingInvoices.filter(i => isBefore(parseISO(i.due_date), new Date()));

  if (!user) {
    return <SkeletonStats />;
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <Card className="max-w-md mx-auto p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Welcome!</h2>
          <p className="text-slate-600">
            Your client account is being set up. Please contact your travel agent for access.
          </p>
        </Card>
      </div>
    );
  }

  const totalPaid = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
//   const pendingProposals = proposals.filter(p => p.status === 'sent').length;
//   const acceptedProposals = proposals.filter(p => p.status === 'accepted').length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Welcome, {client.name}!</h1>
        <p className="text-slate-600">Manage your travel bookings and proposals</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Total Proposals</div>
            <FileText className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{proposals.length}</div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Active Trips</div>
            <Plane className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{trips.length}</div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Total Paid</div>
            <DollarSign className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">${totalPaid.toFixed(2)}</div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-90">Amount Owed</div>
            <DollarSign className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">${(client.total_owed || 0).toFixed(2)}</div>
        </Card>
      </div>

      {/* Featured Products */}
      {featuredItems.length > 0 && (
        <Card className="p-6 bg-white shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Featured Products
            </h2>
            <Link to={createPageUrl('ClientCatalog')}>
              <span className="text-blue-600 hover:text-blue-700 text-sm font-medium">Browse Full Catalog</span>
            </Link>
          </div>

          <Carousel opts={{ align: 'start' }} className="w-full">
            <CarouselContent>
              {featuredItems.map(item => (
                <CarouselItem key={item.pricing_id} className="basis-1/2 md:basis-1/3 lg:basis-1/4">
                  <Link to={createPageUrl('ClientCatalog')}>
                    <Card className="overflow-hidden bg-white border border-slate-200 hover:shadow-lg transition-all p-0 h-full">
                      <div className="h-32 bg-slate-100">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageOff className="w-7 h-7 text-slate-300" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="text-sm font-medium text-slate-800 truncate" title={item.name}>{item.name}</div>
                        <div className="text-xs text-slate-500 truncate">{item.supplier_name}</div>
                        <div className="font-semibold text-green-700 text-sm mt-1">${item.unit_price.toFixed(2)}</div>
                      </div>
                    </Card>
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:flex" />
            <CarouselNext className="hidden sm:flex" />
          </Carousel>
        </Card>
      )}

      {/* Recent Proposals */}
      <Card className="p-6 bg-white shadow-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Recent Proposals</h2>
          <Link to={createPageUrl('ClientProposals')}>
            <span className="text-blue-600 hover:text-blue-700 text-sm font-medium">View All</span>
          </Link>
        </div>

        {proposals.length === 0 ? (
          <p className="text-slate-600 text-center py-8">No proposals yet</p>
        ) : (
          <div className="space-y-4">
            {proposals.slice(0, 3).map(proposal => (
              <Link key={proposal.id} to={createPageUrl(`ClientProposalDetails?id=${proposal.id}`)}>
                <div className="p-4 border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 mb-1">{proposal.title}</h3>
                      <p className="text-sm text-slate-600">{proposal.destination}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-700">${(proposal.total_cost || 0).toFixed(2)}</div>
                      <div className={`text-xs mt-1 px-2 py-1 rounded-full inline-block ${
                        proposal.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                        proposal.status === 'accepted' ? 'bg-green-100 text-green-800' :
                        proposal.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {proposal.status}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Upcoming Trips */}
      <Card className="p-6 bg-white shadow-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Your Trips</h2>
          <Link to={createPageUrl('ClientTrips')}>
            <span className="text-blue-600 hover:text-blue-700 text-sm font-medium">View All</span>
          </Link>
        </div>

        {trips.length === 0 ? (
          <p className="text-slate-600 text-center py-8">No trips booked yet</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trips.slice(0, 2).map(trip => (
              <Link key={trip.id} to={createPageUrl(`ClientTripDetails?id=${trip.id}`)}>
                <div className="p-4 border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center gap-3 mb-2">
                    <Plane className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-slate-900">{trip.name}</h3>
                  </div>
                  <p className="text-sm text-slate-600">{trip.destination}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Invoices Section */}
      <Card className="p-6 bg-white shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            My Invoices
          </h2>
          <Link to={createPageUrl('ClientInvoices')}>
            <Button variant="ghost" size="sm">View All <ArrowRight className="w-4 h-4 ml-1" /></Button>
          </Link>
        </div>
        
        {overdueInvoices.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-800 font-medium">{overdueInvoices.length} overdue invoice(s)</span>
          </div>
        )}

        {pendingInvoices.length === 0 ? (
          <div className="text-center py-4 text-slate-500">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
            All invoices are paid!
          </div>
        ) : (
          <div className="space-y-3">
            {pendingInvoices.slice(0, 3).map(invoice => {
              const isOverdue = isBefore(parseISO(invoice.due_date), new Date());
              return (
                <Link key={invoice.id} to={createPageUrl(`ClientInvoiceDetails?id=${invoice.id}`)}>
                  <div className={`p-4 rounded-lg border ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'} hover:shadow-md transition-shadow`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-slate-900">{invoice.invoice_number}</div>
                        <div className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                          <Calendar className="w-4 h-4" />
                          Due: {format(parseISO(invoice.due_date), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={isOverdue ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}>
                          {isOverdue ? 'Overdue' : 'Pending'}
                        </Badge>
                        <div className="font-bold text-green-700 mt-1">${invoice.amount_due?.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <Card className="p-6 bg-gradient-to-br from-slate-50 to-blue-50 border-blue-200">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Need Help?</h3>
        <p className="text-slate-600 mb-4">
          Contact your travel agent if you have any questions about your bookings or need assistance.
        </p>
      </Card>
    </div>
  );
}