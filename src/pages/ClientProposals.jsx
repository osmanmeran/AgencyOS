import { db } from '@/lib/DbContext';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMyClient } from '@/hooks/useMyClient';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonTable } from '@/components/ui/skeletons';
import { FileText, Calendar, Users, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format } from 'date-fns';
import { useT } from '@/lib/i18n/I18nContext';

const STATUS_COLORS = {
  draft: 'bg-muted text-foreground',
  sent: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
  accepted: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  rejected: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
  expired: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300',
};

export default function ClientProposals() {
  const { t } = useT();
  const client = useMyClient();
  const queryClient = useQueryClient();

  const { data: proposals = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['myProposals', client?.id],
      queryFn: () => db.entities.Proposal.filter({ client_id: client.id }),
      enabled: !!client,
    })
  );

  const updateProposalMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, /** @type {any} */ status }) => {
        const proposal = proposals.find((p) => p.id === id);
        return db.entities.Proposal.update(id, { ...proposal, status });
      },
      onSuccess: () => {
        showSuccess(t('proposals.updateSuccess'));
        queryClient.invalidateQueries({ queryKey: ['myProposals', client?.id] });
      },
      onError: (error) => showError(t('proposals.updateError'), error.message),
    })
  );

  if (!client) {
    return <SkeletonTable />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">{t('clientProposals.title')}</h1>
        <p className="text-muted-foreground">{t('clientProposals.subtitle')}</p>
      </div>

      {proposals.length === 0 ? (
        <Card className="p-12 text-center bg-card">
          <div className="bg-blue-100 dark:bg-blue-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-600 dark:text-blue-300" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">{t('clientProposals.noProposalsTitle')}</h3>
          <p className="text-muted-foreground">{t('clientProposals.noProposalsBody')}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {proposals.map((proposal) => (
            <Card key={proposal.id} className="p-6 bg-card hover:shadow-xl transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg text-foreground">{proposal.title}</h3>
                <Badge className={STATUS_COLORS[proposal.status]}>{t(`proposals.status.${proposal.status}`)}</Badge>
              </div>

              <div className="space-y-3 mb-4">
                {proposal.destination && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <FileText className="w-4 h-4" />
                    {proposal.destination}
                  </div>
                )}
                {proposal.start_date && proposal.end_date && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(proposal.start_date), 'MMM d')} -{' '}
                    {format(new Date(proposal.end_date), 'MMM d, yyyy')}
                  </div>
                )}
                {proposal.num_travelers > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Users className="w-4 h-4" />
                    {t(
                      proposal.num_travelers > 1
                        ? 'clientProposals.travelerPlural'
                        : 'clientProposals.travelerSingular',
                      { count: proposal.num_travelers },
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-border mb-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-muted-foreground text-sm">{t('clientProposals.totalCost')}</span>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300 flex items-center gap-1">
                    <DollarSign className="w-5 h-5" />
                    {(proposal.total_cost || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <Link to={createPageUrl(`ClientProposalDetails?id=${proposal.id}`)}>
                <Button className="w-full mb-2" variant="outline">
                  {t('clientProposals.viewDetails')}
                </Button>
              </Link>

              {proposal.status === 'sent' && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => updateProposalMutation.mutate({ id: proposal.id, status: 'accepted' })}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t('clientProposals.accept')}
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    onClick={() => updateProposalMutation.mutate({ id: proposal.id, status: 'rejected' })}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {t('clientProposals.decline')}
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
