import { db } from '@/lib/DbContext';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonTable } from '@/components/ui/skeletons';
import { FileText, Calendar, Users, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format } from 'date-fns';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800'
};

export default function ClientProposals() {
  const [client, setClient] = React.useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    db.auth.me().then(async (user) => {
      const clients = await db.entities.Client.filter({ email: user.email });
      if (clients.length > 0) {
        setClient(clients[0]);
      }
    });
  }, []);

  const { data: proposals = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['myProposals', client?.id],
    queryFn: () => db.entities.Proposal.filter({ client_id: client.id }),
    enabled: !!client
  }));

  const updateProposalMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ { id, /** @type {any} */ status }) => {
      const proposal = proposals.find(p => p.id === id);
      return db.entities.Proposal.update(id, { ...proposal, status });
    },
    onSuccess: () => {
      showSuccess('Proposal updated');
      queryClient.invalidateQueries({ queryKey: ['myProposals', client?.id] });
    },
    onError: (error) => showError('Failed to update proposal', error.message)
  }));

  if (!client) {
    return <SkeletonTable />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">My Proposals</h1>
        <p className="text-slate-600">View and respond to travel proposals</p>
      </div>

      {proposals.length === 0 ? (
        <Card className="p-12 text-center bg-white">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No proposals yet</h3>
          <p className="text-slate-600">Your travel agent will send you proposals here</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {proposals.map(proposal => (
            <Card key={proposal.id} className="p-6 bg-white hover:shadow-xl transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg text-slate-900">{proposal.title}</h3>
                <Badge className={STATUS_COLORS[proposal.status]}>
                  {proposal.status}
                </Badge>
              </div>

              <div className="space-y-3 mb-4">
                {proposal.destination && (
                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                    <FileText className="w-4 h-4" />
                    {proposal.destination}
                  </div>
                )}
                {proposal.start_date && proposal.end_date && (
                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(proposal.start_date), 'MMM d')} - {format(new Date(proposal.end_date), 'MMM d, yyyy')}
                  </div>
                )}
                {proposal.num_travelers > 0 && (
                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                    <Users className="w-4 h-4" />
                    {proposal.num_travelers} traveler{proposal.num_travelers > 1 ? 's' : ''}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 mb-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-slate-600 text-sm">Total Cost</span>
                  <div className="text-2xl font-bold text-green-700 flex items-center gap-1">
                    <DollarSign className="w-5 h-5" />
                    {(proposal.total_cost || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <Link to={createPageUrl(`ClientProposalDetails?id=${proposal.id}`)}>
                <Button className="w-full mb-2" variant="outline">
                  View Details
                </Button>
              </Link>

              {proposal.status === 'sent' && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => updateProposalMutation.mutate({ id: proposal.id, status: 'accepted' })}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Accept
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    onClick={() => updateProposalMutation.mutate({ id: proposal.id, status: 'rejected' })}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Decline
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}