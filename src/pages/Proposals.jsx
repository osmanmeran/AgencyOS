import { db } from '@/lib/DbContext';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useExport } from '@/hooks/useExport';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonTable } from '@/components/ui/skeletons';
import { Plus, FileText, Calendar, Users as UsersIcon, DollarSign, History, Trash2, Download } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useT } from '@/lib/i18n/I18nContext';

const STATUS_COLORS = {
  delivered: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
  changed: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',
  approved: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  rejected: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
};

export default function Proposals() {
  const { t } = useT();
  const queryClient = useQueryClient();
  const { exportCSV } = useExport();

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.Proposal.delete(id),
      onSuccess: () => {
        showSuccess(t('proposals.deleteSuccess'));
        queryClient.invalidateQueries({ queryKey: ['proposals'] });
      },
      onError: (error) => showError(t('proposals.deleteError'), error.message),
    })
  );

  const { data: proposals = /** @type {any} */ ([]), isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['proposals'],
      queryFn: () => db.entities.Proposal.list('-created_date'),
    })
  );

  if (isLoading) {
    return <SkeletonTable />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">{t('proposals.title')}</h1>
          <p className="text-muted-foreground">{t('proposals.listSubtitle')}</p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            exportCSV(proposals, 'proposals', [
              { label: 'Title', accessor: (p) => p.title },
              { label: 'Client Name', accessor: (p) => p.client_name },
              { label: 'Destination', accessor: (p) => p.destination },
              { label: 'Status', accessor: (p) => p.status },
              { label: 'Total Cost', accessor: (p) => p.total_cost },
              { label: 'Created Date', accessor: (p) => p.created_date },
            ])
          }
        >
          <Download className="w-4 h-4 mr-2" />
          {t('common.exportCsv')}
        </Button>
        <Link to={createPageUrl('CreateProposal')}>
          <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg">
            <Plus className="w-5 h-5 mr-2" />
            {t('proposals.newProposal')}
          </Button>
        </Link>
      </div>

      {proposals.length === 0 ? (
        <Card className="p-12 text-center bg-card shadow-md">
          <div className="bg-blue-100 dark:bg-blue-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-600 dark:text-blue-300" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">{t('proposals.noProposalsTitle')}</h3>
          <p className="text-muted-foreground mb-6">{t('proposals.noProposalsBody')}</p>
          <Link to={createPageUrl('CreateProposal')}>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              {t('proposals.createFirst')}
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {proposals.map((proposal) => (
            <div key={proposal.id} className="relative group/card">
              <button
                className="absolute top-3 right-3 z-10 p-1.5 rounded-md text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 opacity-0 group-hover/card:opacity-100 transition-all"
                onClick={(e) => {
                  e.preventDefault();
                  if (confirm(t('proposals.deleteConfirm'))) deleteMutation.mutate(proposal.id);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <Link key={proposal.id} to={createPageUrl(`ProposalDetails?id=${proposal.id}`)}>
                <Card className="p-6 bg-card hover:shadow-xl transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-foreground mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
                        {proposal.title}
                      </h3>
                      <p className="text-muted-foreground text-sm">{proposal.client_name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={STATUS_COLORS[proposal.status] || 'bg-muted text-foreground'}>
                        {STATUS_COLORS[proposal.status]
                          ? t(`proposals.proposalStatus.${proposal.status}`)
                          : proposal.status}
                      </Badge>
                      {proposal.change_history?.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <History className="w-3 h-3" />
                          {t(
                            proposal.change_history.length === 1
                              ? 'proposals.changeSingular'
                              : 'proposals.changePlural',
                            { count: proposal.change_history.length },
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {proposal.start_date && proposal.end_date ? (
                        <span>
                          {format(new Date(proposal.start_date), 'MMM d')} -{' '}
                          {format(new Date(proposal.end_date), 'MMM d, yyyy')}
                        </span>
                      ) : (
                        <span>{t('proposals.datesNotSet')}</span>
                      )}
                    </div>
                    {proposal.destination && (
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {proposal.destination}
                      </div>
                    )}
                    {proposal.num_travelers > 0 && (
                      <div className="flex items-center gap-2">
                        <UsersIcon className="w-4 h-4" />
                        {t(
                          proposal.num_travelers === 1
                            ? 'clientProposals.travelerSingular'
                            : 'clientProposals.travelerPlural',
                          { count: proposal.num_travelers },
                        )}
                      </div>
                    )}
                  </div>

                  {proposal.total_cost > 0 && (
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-muted-foreground text-sm">{t('clientProposals.totalCost')}</span>
                        <div className="flex items-center gap-1 text-green-700 dark:text-green-300 font-bold text-lg">
                          <DollarSign className="w-5 h-5" />
                          {proposal.total_cost.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
