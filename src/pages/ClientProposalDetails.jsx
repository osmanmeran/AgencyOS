const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeletons';
import { ArrowLeft, Calendar, Users, CheckCircle, XCircle, MapPin } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format } from 'date-fns';
import MessageThread from '../components/messaging/MessageThread';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800'
};

export default function ClientProposalDetails() {
  const [searchParams] = useSearchParams();
  const proposalId = searchParams.get('id');
  const queryClient = useQueryClient();
  const [client, setClient] = React.useState(null);

  React.useEffect(() => {
    db.auth.me().then(async (user) => {
      const clients = await db.entities.Client.filter({ email: user.email });
      if (clients.length > 0) {
        setClient(clients[0]);
      }
    });
  }, []);

  const { data: proposal, isLoading } = /** @type {any} */ (useQuery({
    queryKey: ['proposal', proposalId],
    queryFn: () => db.entities.Proposal.get(proposalId),
    enabled: !!proposalId
  }));

  const updateProposalMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ status) => db.entities.Proposal.update(proposalId, { ...proposal, status }),
    onSuccess: () => {
      showSuccess('Proposal updated');
      queryClient.invalidateQueries({ queryKey: ['proposal', proposalId] });
      queryClient.invalidateQueries({ queryKey: ['myProposals', client?.id] });
    },
    onError: (error) => showError('Failed to update proposal', error.message)
  }));

  if (isLoading) {
    return <SkeletonCard />;
  }

  if (!proposal || !client || proposal.client_id !== client.id) {
    return <div className="text-center py-20">Proposal not found or access denied</div>;
  }

  return (
    <div className="space-y-6">
      <Link to={createPageUrl('ClientProposals')}>
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Proposals
        </Button>
      </Link>

      {/* Proposal Header */}
      <Card className="p-8 bg-white shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{proposal.title}</h1>
          </div>
          <Badge className={STATUS_COLORS[proposal.status]}>
            {proposal.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-slate-200">
          {proposal.destination && (
            <div>
              <div className="text-sm text-slate-600 mb-1">Destination</div>
              <div className="font-semibold text-slate-900">{proposal.destination}</div>
            </div>
          )}
          {proposal.start_date && proposal.end_date && (
            <div>
              <div className="text-sm text-slate-600 mb-1 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Travel Dates
              </div>
              <div className="font-semibold text-slate-900">
                {format(new Date(proposal.start_date), 'MMM d')} - {format(new Date(proposal.end_date), 'MMM d, yyyy')}
              </div>
            </div>
          )}
          {proposal.num_travelers > 0 && (
            <div>
              <div className="text-sm text-slate-600 mb-1 flex items-center gap-1">
                <Users className="w-4 h-4" />
                Travelers
              </div>
              <div className="font-semibold text-slate-900">{proposal.num_travelers} person{proposal.num_travelers > 1 ? 's' : ''}</div>
            </div>
          )}
        </div>
      </Card>

      {/* Services */}
      <Card className="p-8 bg-white shadow-lg">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Services Included</h2>
        {proposal.services && proposal.services.length > 0 ? (
          <div className="space-y-4">
            {proposal.services.map((service, index) => {
              const sc = ({ USD: '$', EUR: '€', GBP: '£', TRY: '₺', AED: 'د.إ', SAR: '﷼', EGP: 'E£', MAD: 'MAD', JPY: '¥', CHF: 'CHF', CAD: 'CA$', AUD: 'A$' }[service.client_currency] || service.client_currency || '$');
              return (
                <div key={index} className="border-b border-slate-200 pb-4 last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-slate-900">{service.name}</h3>
                      {service.description && (
                        <p className="text-slate-600 text-sm mt-1">{service.description}</p>
                      )}
                      {service.location && (
                        <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{service.location}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm text-slate-600">
                        {sc}{(service.cost || 0).toFixed(2)} × {service.quantity || 1}
                      </div>
                      <div className="font-bold text-lg text-slate-900">
                        {sc}{((service.cost || 0) * (service.quantity || 1)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="pt-6 mt-6 border-t-2 border-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold text-slate-900">Total</span>
                <div className="text-4xl font-bold text-green-700 flex items-center gap-2">
                  {(() => {
                    const currencies = [...new Set((proposal.services || []).map(s => s.client_currency).filter(Boolean))];
                    const sc = ({ USD: '$', EUR: '€', GBP: '£', TRY: '₺', AED: 'د.إ', SAR: '﷼', EGP: 'E£', MAD: 'MAD', JPY: '¥', CHF: 'CHF', CAD: 'CA$', AUD: 'A$' }[currencies[0] || 'USD'] || currencies[0] || '$');
                    return <span>{sc}</span>;
                  })()}
                  {(proposal.total_cost || 0).toFixed(2)}
                  {(() => {
                    const currencies = [...new Set((proposal.services || []).map(s => s.client_currency).filter(Boolean))];
                    return currencies.length > 1 ? <span className="text-sm text-slate-400 font-normal">({currencies.join('/')})</span> : null;
                  })()}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-600">No services added</p>
        )}
      </Card>

      {/* Notes */}
      {proposal.notes && (
        <Card className="p-8 bg-white shadow-lg">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Notes</h2>
          <p className="text-slate-700 whitespace-pre-wrap">{proposal.notes}</p>
        </Card>
      )}

      {/* Terms */}
      {proposal.terms_and_conditions && (
        <Card className="p-8 bg-slate-50">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Terms & Conditions</h2>
          <p className="text-slate-700 text-sm whitespace-pre-wrap">{proposal.terms_and_conditions}</p>
        </Card>
      )}

      {/* Action Buttons */}
      {proposal.status === 'sent' && (
        <Card className="p-6 bg-white shadow-lg">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Response Required</h3>
          <p className="text-slate-600 mb-6">
            Please review the proposal and let us know if you'd like to proceed.
          </p>
          <div className="flex gap-4">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              size="lg"
              onClick={() => updateProposalMutation.mutate('accepted')}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Accept Proposal
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              size="lg"
              onClick={() => updateProposalMutation.mutate('rejected')}
            >
              <XCircle className="w-5 h-5 mr-2" />
              Decline Proposal
            </Button>
          </div>
        </Card>
      )}

      {proposal.status === 'accepted' && (
        <Card className="p-6 bg-green-50 border-green-200">
          <div className="flex items-center gap-3 text-green-800">
            <CheckCircle className="w-6 h-6" />
            <div>
              <h3 className="font-bold">Proposal Accepted</h3>
              <p className="text-sm">Your travel agent will be in touch shortly to finalize the booking.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Messaging */}
      <MessageThread 
        clientId={client.id} 
        referenceType="proposal" 
        referenceId={proposalId}
        isAgent={false}
      />
    </div>
  );
}