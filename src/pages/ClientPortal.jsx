import { db } from '@/lib/DbContext';

import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonStats } from '@/components/ui/skeletons';
import {
  FileText,
  Plane,
  DollarSign,
  CheckCircle,
  CreditCard,
  ArrowRight,
  Calendar,
  AlertCircle,
  ShoppingCart,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format, parseISO, isBefore } from 'date-fns';
import { getActAsClientId, useActAsClientId } from '@/lib/actAsClient';

export default function ClientPortal() {
  const [user, setUser] = React.useState(null);
  const [client, setClient] = React.useState(null);
  const actAsClientId = useActAsClientId();

  React.useEffect(() => {
    db.auth.me().then(async (currentUser) => {
      setUser(currentUser);
      // Staff viewing the portal "as" a client resolve that client instead of
      // their own (they have none). Prefer the authoritative client_id from
      // the JWT otherwise — email matching alone silently fails whenever the
      // portal login email differs from the CRM contact's email.
      let resolved = null;
      const asClientId = getActAsClientId();
      if (asClientId && currentUser.user_tier !== 'client') {
        resolved = await db.entities.Client.get(asClientId).catch(() => null);
      } else {
        if (currentUser.client_id) {
          resolved = await db.entities.Client.get(currentUser.client_id).catch(() => null);
        }
        if (!resolved && currentUser.email) {
          const clients = await db.entities.Client.filter({ email: currentUser.email });
          resolved = clients[0] || null;
        }
      }
      setClient(resolved);
    });
  }, [actAsClientId]);

  const { data: proposals = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['myProposals', client?.id],
      queryFn: () => db.entities.Proposal.filter({ client_id: client.id }),
      enabled: !!client,
    })
  );

  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['myTrips', client?.id],
      queryFn: () => db.entities.Trip.filter({ client_id: client.id }),
      enabled: !!client,
    })
  );

  const { data: payments = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['myPayments', client?.id],
      queryFn: () => db.entities.ClientPayment.filter({ client_id: client.id }),
      enabled: !!client,
    })
  );

  const { data: invoices = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['myInvoices', client?.id],
      queryFn: () => db.entities.Invoice.filter({ client_id: client.id }),
      enabled: !!client,
    })
  );

  const pendingInvoices = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled');
  const overdueInvoices = pendingInvoices.filter((i) => isBefore(parseISO(i.due_date), new Date()));

  if (!user) {
    return <SkeletonStats />;
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <Card className="max-w-md mx-auto p-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Welcome!</h2>
          <p className="text-muted-foreground">
            Your client account is being set up. Please contact your travel agent for access.
          </p>
        </Card>
      </div>
    );
  }

  const totalPaid = payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Welcome, {client.name}!</h1>
        <p className="text-muted-foreground">Track your trips and invoices, or build your next one</p>
      </div>

      {/* Request a Quote CTA */}
      <Card className="p-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-1">
              <ShoppingCart className="w-5 h-5" />
              Ready to plan your next trip?
            </h2>
            <p className="text-blue-100">Build your itinerary from our services and send us a quote request.</p>
          </div>
          <Link to={createPageUrl('ClientQuoteBuilder')}>
            <Button className="bg-card text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 whitespace-nowrap">
              Request a Quote
            </Button>
          </Link>
        </div>
      </Card>

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

      {/* Recent Proposals */}
      <Card className="p-6 bg-card shadow-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-foreground">Recent Proposals</h2>
          <Link to={createPageUrl('ClientProposals')}>
            <span className="text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium">
              View All
            </span>
          </Link>
        </div>

        {proposals.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No proposals yet</p>
        ) : (
          <div className="space-y-4">
            {proposals.slice(0, 3).map((proposal) => (
              <Link key={proposal.id} to={createPageUrl(`ClientProposalDetails?id=${proposal.id}`)}>
                <div className="p-4 border border-border rounded-lg hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-1">{proposal.title}</h3>
                      <p className="text-sm text-muted-foreground">{proposal.destination}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-700 dark:text-green-300">
                        ${(proposal.total_cost || 0).toFixed(2)}
                      </div>
                      <div
                        className={`text-xs mt-1 px-2 py-1 rounded-full inline-block ${
                          proposal.status === 'sent'
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300'
                            : proposal.status === 'accepted'
                              ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
                              : proposal.status === 'rejected'
                                ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                                : 'bg-muted text-foreground'
                        }`}
                      >
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
      <Card className="p-6 bg-card shadow-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-foreground">Your Trips</h2>
          <Link to={createPageUrl('ClientTrips')}>
            <span className="text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium">
              View All
            </span>
          </Link>
        </div>

        {trips.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No trips booked yet</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trips.slice(0, 2).map((trip) => (
              <Link key={trip.id} to={createPageUrl(`ClientTripDetails?id=${trip.id}`)}>
                <div className="p-4 border border-border rounded-lg hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center gap-3 mb-2">
                    <Plane className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                    <h3 className="font-semibold text-foreground">{trip.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{trip.destination}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Invoices Section */}
      <Card className="p-6 bg-card shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            My Invoices
          </h2>
          <Link to={createPageUrl('ClientInvoices')}>
            <Button variant="ghost" size="sm">
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>

        {overdueInvoices.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-300" />
            <span className="text-red-800 dark:text-red-300 font-medium">
              {overdueInvoices.length} overdue invoice(s)
            </span>
          </div>
        )}

        {pendingInvoices.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500 dark:text-green-300" />
            All invoices are paid!
          </div>
        ) : (
          <div className="space-y-3">
            {pendingInvoices.slice(0, 3).map((invoice) => {
              const isOverdue = isBefore(parseISO(invoice.due_date), new Date());
              return (
                <Link key={invoice.id} to={createPageUrl(`ClientInvoiceDetails?id=${invoice.id}`)}>
                  <div
                    className={`p-4 rounded-lg border ${isOverdue ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800' : 'bg-muted border-border'} hover:shadow-md transition-shadow`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-foreground">{invoice.invoice_number}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="w-4 h-4" />
                          Due: {format(parseISO(invoice.due_date), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          className={
                            isOverdue
                              ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                              : 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300'
                          }
                        >
                          {isOverdue ? 'Overdue' : 'Pending'}
                        </Badge>
                        <div className="font-bold text-green-700 dark:text-green-300 mt-1">
                          ${invoice.amount_due?.toFixed(2)}
                        </div>
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
      <Card className="p-6 bg-gradient-to-br from-muted to-blue-50 dark:to-blue-950/40 border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-bold text-foreground mb-4">Need Help?</h3>
        <p className="text-muted-foreground mb-4">
          Contact your travel agent if you have any questions about your bookings or need assistance.
        </p>
      </Card>
    </div>
  );
}
