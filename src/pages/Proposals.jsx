const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
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

const STATUS_COLORS = {
  delivered: 'bg-blue-100 text-blue-800',
  changed: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800'
};

const STATUS_LABELS = {
  delivered: 'Delivered',
  changed: 'Changed',
  approved: 'Approved',
  rejected: 'Rejected'
};

export default function Proposals() {
  const queryClient = useQueryClient();
  const { exportCSV } = useExport();

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.Proposal.delete(id),
    onSuccess: () => {
      showSuccess('Proposal deleted');
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
    onError: (error) => showError('Failed to delete proposal', error.message)
  });

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => db.entities.Proposal.list('-created_date')
  });

  if (isLoading) {
    return <SkeletonTable />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Proposals</h1>
          <p className="text-slate-600">Create and manage travel proposals for clients</p>
        </div>
        <Button variant="outline" onClick={() => exportCSV(proposals, 'proposals', [
          { label: 'Title', accessor: (p) => p.title },
          { label: 'Client Name', accessor: (p) => p.client_name },
          { label: 'Destination', accessor: (p) => p.destination },
          { label: 'Status', accessor: (p) => p.status },
          { label: 'Total Cost', accessor: (p) => p.total_cost },
          { label: 'Created Date', accessor: (p) => p.created_date }
        ])}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
        <Link to={createPageUrl('CreateProposal')}>
          <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg">
            <Plus className="w-5 h-5 mr-2" />
            New Proposal
          </Button>
        </Link>
      </div>

      {proposals.length === 0 ? (
        <Card className="p-12 text-center bg-white shadow-md">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No proposals yet</h3>
          <p className="text-slate-600 mb-6">Start creating proposals from your supplier database</p>
          <Link to={createPageUrl('CreateProposal')}>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Create First Proposal
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {proposals.map(proposal => (
            <div key={proposal.id} className="relative group/card">
              <button
                className="absolute top-3 right-3 z-10 p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover/card:opacity-100 transition-all"
                onClick={(e) => { e.preventDefault(); if (confirm('Delete this proposal?')) deleteMutation.mutate(proposal.id); }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            <Link key={proposal.id} to={createPageUrl(`ProposalDetails?id=${proposal.id}`)}>
              <Card className="p-6 bg-white hover:shadow-xl transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                      {proposal.title}
                    </h3>
                    <p className="text-slate-600 text-sm">{proposal.client_name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={STATUS_COLORS[proposal.status] || 'bg-gray-100 text-gray-800'}>
                      {STATUS_LABELS[proposal.status] || proposal.status}
                    </Badge>
                    {proposal.change_history?.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <History className="w-3 h-3" />
                        {proposal.change_history.length} change{proposal.change_history.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm text-slate-600 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {proposal.start_date && proposal.end_date ? (
                      <span>
                        {format(new Date(proposal.start_date), 'MMM d')} - {format(new Date(proposal.end_date), 'MMM d, yyyy')}
                      </span>
                    ) : (
                      <span>Dates not set</span>
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
                      {proposal.num_travelers} traveler{proposal.num_travelers > 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                {proposal.total_cost > 0 && (
                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 text-sm">Total Cost</span>
                      <div className="flex items-center gap-1 text-green-700 font-bold text-lg">
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