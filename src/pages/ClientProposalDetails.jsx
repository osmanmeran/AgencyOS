import { db } from '@/lib/DbContext';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMyClient } from '@/hooks/useMyClient';

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
  draft: 'bg-muted text-foreground',
  sent: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
  accepted: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  rejected: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
  expired: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300',
};

export default function ClientProposalDetails() {
  const [searchParams] = useSearchParams();
  const proposalId = searchParams.get('id');
  const queryClient = useQueryClient();
  const client = useMyClient();

  const { data: proposal, isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['proposal', proposalId],
      queryFn: () => db.entities.Proposal.get(proposalId),
      enabled: !!proposalId,
    })
  );

  const updateProposalMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ status) => db.entities.Proposal.update(proposalId, { ...proposal, status }),
      onSuccess: () => {
        showSuccess('Proposal updated');
        queryClient.invalidateQueries({ queryKey: ['proposal', proposalId] });
        queryClient.invalidateQueries({ queryKey: ['myProposals', client?.id] });
      },
      onError: (error) => showError('Failed to update proposal', error.message),
    })
  );

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
      <Card className="p-8 bg-card shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{proposal.title}</h1>
          </div>
          <Badge className={STATUS_COLORS[proposal.status]}>{proposal.status}</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-border">
          {proposal.destination && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Destination</div>
              <div className="font-semibold text-foreground">{proposal.destination}</div>
            </div>
          )}
          {proposal.start_date && proposal.end_date && (
            <div>
              <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Travel Dates
              </div>
              <div className="font-semibold text-foreground">
                {format(new Date(proposal.start_date), 'MMM d')} - {format(new Date(proposal.end_date), 'MMM d, yyyy')}
              </div>
            </div>
          )}
          {proposal.num_travelers > 0 && (
            <div>
              <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                <Users className="w-4 h-4" />
                Travelers
              </div>
              <div className="font-semibold text-foreground">
                {proposal.num_travelers} person{proposal.num_travelers > 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Services */}
      <Card className="p-8 bg-card shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-6">Services Included</h2>
        {proposal.services && proposal.services.length > 0 ? (
          <div className="space-y-4">
            {proposal.services.map((service, index) => {
              const sc =
                {
                  USD: '$',
                  EUR: '€',
                  GBP: '£',
                  TRY: '₺',
                  AED: 'د.إ',
                  SAR: '﷼',
                  EGP: 'E£',
                  MAD: 'MAD',
                  JPY: '¥',
                  CHF: 'CHF',
                  CAD: 'CA$',
                  AUD: 'A$',
                }[service.client_currency] ||
                service.client_currency ||
                '$';
              return (
                <div key={index} className="border-b border-border pb-4 last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-foreground">{service.name}</h3>
                      {service.description && (
                        <p className="text-muted-foreground text-sm mt-1">{service.description}</p>
                      )}
                      {service.location && (
                        <p className="text-muted-foreground text-xs mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {service.location}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm text-muted-foreground">
                        {sc}
                        {(service.cost || 0).toFixed(2)} × {service.quantity || 1}
                      </div>
                      <div className="font-bold text-lg text-foreground">
                        {sc}
                        {((service.cost || 0) * (service.quantity || 1)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="pt-6 mt-6 border-t-2 border-border">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <span className="text-2xl font-bold text-foreground">Total</span>
                <div className="text-4xl font-bold text-green-700 dark:text-green-300 flex items-center gap-2">
                  {(() => {
                    const currencies = [
                      ...new Set((proposal.services || []).map((s) => s.client_currency).filter(Boolean)),
                    ];
                    const sc =
                      {
                        USD: '$',
                        EUR: '€',
                        GBP: '£',
                        TRY: '₺',
                        AED: 'د.إ',
                        SAR: '﷼',
                        EGP: 'E£',
                        MAD: 'MAD',
                        JPY: '¥',
                        CHF: 'CHF',
                        CAD: 'CA$',
                        AUD: 'A$',
                      }[currencies[0] || 'USD'] ||
                      currencies[0] ||
                      '$';
                    return <span>{sc}</span>;
                  })()}
                  {(proposal.total_cost || 0).toFixed(2)}
                  {(() => {
                    const currencies = [
                      ...new Set((proposal.services || []).map((s) => s.client_currency).filter(Boolean)),
                    ];
                    return currencies.length > 1 ? (
                      <span className="text-sm text-muted-foreground font-normal">({currencies.join('/')})</span>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">No services added</p>
        )}
      </Card>

      {/* Notes */}
      {proposal.notes && (
        <Card className="p-8 bg-card shadow-lg">
          <h2 className="text-2xl font-bold text-foreground mb-4">Notes</h2>
          <p className="text-foreground whitespace-pre-wrap">{proposal.notes}</p>
        </Card>
      )}

      {/* Terms */}
      {proposal.terms_and_conditions && (
        <Card className="p-8 bg-muted">
          <h2 className="text-xl font-bold text-foreground mb-4">Terms & Conditions</h2>
          <p className="text-foreground text-sm whitespace-pre-wrap">{proposal.terms_and_conditions}</p>
        </Card>
      )}

      {/* Action Buttons */}
      {proposal.status === 'sent' && (
        <Card className="p-6 bg-card shadow-lg">
          <h3 className="text-lg font-bold text-foreground mb-4">Response Required</h3>
          <p className="text-muted-foreground mb-6">
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
        <Card className="p-6 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800">
          <div className="flex items-center gap-3 text-green-800 dark:text-green-300">
            <CheckCircle className="w-6 h-6" />
            <div>
              <h3 className="font-bold">Proposal Accepted</h3>
              <p className="text-sm">Your travel agent will be in touch shortly to finalize the booking.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Messaging */}
      <MessageThread clientId={client.id} referenceType="proposal" referenceId={proposalId} isAgent={false} />
    </div>
  );
}
