import { db } from '@/lib/DbContext';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import ClientList from '../components/crm/ClientList';
import ClientPanel from '../components/crm/ClientPanel';
import NewClientForm from '../components/crm/NewClientForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, X, Users, ArrowLeft, List, Search,
  TrendingUp, UserCheck, Star, DollarSign
} from 'lucide-react';
import { filterClientsByCompany } from '../lib/companySearch';

const PIPELINE_STAGES = [
  { key: 'new', label: 'New Lead', color: 'bg-slate-100 border-slate-300' },
  { key: 'contacted', label: 'Contacted', color: 'bg-blue-50 border-blue-300' },
  { key: 'proposal', label: 'Proposal Sent', color: 'bg-amber-50 border-amber-300' },
  { key: 'negotiation', label: 'Negotiation', color: 'bg-purple-50 border-purple-300' },
  { key: 'won', label: 'Won', color: 'bg-green-50 border-green-300' },
  { key: 'lost', label: 'Lost', color: 'bg-red-50 border-red-300' },
];

function DealCard({ client }) {
  const initials = (client.name || '??').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 truncate">{client.name}</div>
          {client.company && <div className="text-[10px] text-slate-400 truncate">{client.company}</div>}
        </div>
        {client.potential_deal && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
      </div>
      {client.email && <div className="text-[11px] text-slate-500 truncate">{client.email}</div>}
      {client.total_paid > 0 && (
        <div className="mt-2 text-xs font-semibold text-green-700">${(client.total_paid || 0).toFixed(0)}</div>
      )}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${client.status === 'active' ? 'bg-green-500' : client.status === 'vip' ? 'bg-purple-500' : 'bg-slate-300'}`} />
        <span className="text-[10px] text-slate-400 capitalize">{client.status}</span>
      </div>
    </div>
  );
}

function getDealStage(client) {
  if (client.deal_stage && PIPELINE_STAGES.find(s => s.key === client.deal_stage)) return client.deal_stage;
  if (client.status === 'cancelled') return 'lost';
  if ((client.total_paid || 0) > 0) return 'won';
  return client.potential_deal ? 'proposal' : 'new';
}

export default function ClientCRM() {
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: clients = /** @type {any} */ ([]), isLoading } = /** @type {any} */ (useQuery({
    queryKey: ['clients'],
    queryFn: () => db.entities.Client.list('-created_date')
  }));

  const selectedClient = clients.find(c => c.id === selectedClientId) || null;

  const { results: filtered, colleagueIds } = useMemo(
    () => filterClientsByCompany(clients, searchQuery),
    [clients, searchQuery]
  );

  const stats = useMemo(() => ({
    total: clients.length,
    active: clients.filter(c => c.status === 'active' || c.status === 'vip').length,
    vip: clients.filter(c => c.status === 'vip').length,
    totalRevenue: clients.reduce((s, c) => s + (parseFloat(c.total_paid) || 0), 0),
  }), [clients]);

  const pipelineClients = useMemo(() => {
    const groups = {};
    PIPELINE_STAGES.forEach(s => { groups[s.key] = []; });
    filtered.forEach(c => {
      const stage = getDealStage(c);
      if (groups[stage]) groups[stage].push(c);
    });
    return groups;
  }, [filtered]);

  const handleClientCreated = (newClient) => {
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    setShowNewForm(false);
    setSelectedClientId(newClient.id);
  };

  const handleBack = () => {
    setSelectedClientId(null);
    setShowNewForm(false);
  };

  /* updateDealStage removed (unused) */

  if (showNewForm || selectedClient) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={handleBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Clients
          </Button>
        </div>
        {showNewForm ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">New Client</h2>
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <NewClientForm onCreated={handleClientCreated} onCancel={handleBack} />
          </div>
        ) : (
          <ClientPanel client={selectedClient} onClientUpdated={() => queryClient.invalidateQueries({ queryKey: ['clients'] })} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2.5 rounded-xl shadow-md">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">CRM</h1>
            <p className="text-sm text-slate-500">{stats.total} contacts · {stats.active} active</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowNewForm(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />New Client
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-medium">Total Contacts</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Across all statuses</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-medium">Active</span>
            <UserCheck className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-700">{stats.active}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Active & VIP clients</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-medium">VIP</span>
            <Star className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-700">{stats.vip}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Premium clients</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-medium">Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">${stats.totalRevenue.toFixed(0)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Total collected</div>
        </div>
      </div>

      {/* View toggle + search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search contacts or company..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 text-sm h-9"
          />
        </div>
        <div className="flex items-center border border-slate-200 rounded-lg bg-white p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <List className="w-3.5 h-3.5" />List
          </button>
          <button
            onClick={() => setViewMode('pipeline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'pipeline' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />Pipeline
          </button>
        </div>
      </div>

      {/* Pipeline / Kanban Board */}
      {viewMode === 'pipeline' ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[900px]">
            {PIPELINE_STAGES.map(stage => {
              const cards = pipelineClients[stage.key] || [];
              return (
                <div key={stage.key} className="flex-1 min-w-[140px]">
                  <div className={`rounded-lg border-2 ${stage.color} p-3 mb-3`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{stage.label}</span>
                      <span className="text-xs font-bold text-slate-400 bg-white rounded-full w-5 h-5 flex items-center justify-center">{cards.length}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {cards.map(client => (
                      <div key={client.id} onClick={() => setSelectedClientId(client.id)}>
                        <DealCard client={client} />
                      </div>
                    ))}
                    {cards.length === 0 && (
                      <div className="text-center py-6 text-[11px] text-slate-300 italic">No contacts</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Table View */
        <ClientList
          clients={filtered}
          colleagueIds={colleagueIds}
          isLoading={isLoading}
          selectedId={selectedClientId}
          onSelect={(id) => setSelectedClientId(id)}
          onClientsDeleted={(deletedIds) => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            if (deletedIds?.has(selectedClientId)) setSelectedClientId(null);
          }}
        />
      )}
    </div>
  );
}
