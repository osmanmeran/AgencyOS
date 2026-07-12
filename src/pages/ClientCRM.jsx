import { db } from '@/lib/DbContext';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import ClientList from '../components/crm/ClientList';
import ClientPanel from '../components/crm/ClientPanel';
import NewClientForm from '../components/crm/NewClientForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Users, ArrowLeft, List, Search, TrendingUp, UserCheck, Star, DollarSign } from 'lucide-react';
import { filterClientsByCompany } from '../lib/companySearch';
import { useT } from '@/lib/i18n/I18nContext';
import { getCurrencySymbol } from '@/lib/formatters';

function usePipelineStages() {
  const { t } = useT();
  return [
    { key: 'new', label: t('clientCRM.stages.newLead'), color: 'bg-muted border-border' },
    {
      key: 'contacted',
      label: t('clientCRM.stages.contacted'),
      color: 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800',
    },
    {
      key: 'proposal',
      label: t('clientCRM.stages.proposalSent'),
      color: 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800',
    },
    {
      key: 'negotiation',
      label: t('clientCRM.stages.negotiation'),
      color: 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800',
    },
    {
      key: 'won',
      label: t('clientCRM.stages.won'),
      color: 'bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800',
    },
    {
      key: 'lost',
      label: t('clientCRM.stages.lost'),
      color: 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800',
    },
  ];
}

function DealCard({ client }) {
  const initials = (client.name || '??')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="bg-card rounded-lg border border-border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground truncate">{client.name}</div>
          {client.company && <div className="text-[10px] text-muted-foreground truncate">{client.company}</div>}
        </div>
        {client.potential_deal && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
      </div>
      {client.email && <div className="text-[11px] text-muted-foreground truncate">{client.email}</div>}
      {client.total_paid > 0 && (
        <div className="mt-2 text-xs font-semibold text-green-700 dark:text-green-300">
          {getCurrencySymbol(client.preferred_currency || 'USD')}
          {(client.total_paid || 0).toFixed(0)}
        </div>
      )}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${client.status === 'active' ? 'bg-green-500' : client.status === 'vip' ? 'bg-purple-500' : 'bg-muted-foreground/40'}`}
        />
        <span className="text-[10px] text-muted-foreground capitalize">{client.status}</span>
      </div>
    </div>
  );
}

const STAGE_KEYS = ['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost'];

function getDealStage(client) {
  if (client.deal_stage && STAGE_KEYS.includes(client.deal_stage)) return client.deal_stage;
  if (client.status === 'cancelled') return 'lost';
  if ((client.total_paid || 0) > 0) return 'won';
  return client.potential_deal ? 'proposal' : 'new';
}

export default function ClientCRM() {
  const { t } = useT();
  const PIPELINE_STAGES = usePipelineStages();
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: clients = /** @type {any} */ ([]), isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['clients'],
      queryFn: () => db.entities.Client.list('-created_date'),
    })
  );

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

  const { results: filtered, colleagueIds } = useMemo(
    () => filterClientsByCompany(clients, searchQuery),
    [clients, searchQuery],
  );

  const stats = useMemo(
    () => ({
      total: clients.length,
      active: clients.filter((c) => c.status === 'active' || c.status === 'vip').length,
      vip: clients.filter((c) => c.status === 'vip').length,
      totalRevenue: clients.reduce((s, c) => s + (parseFloat(c.total_paid) || 0), 0),
    }),
    [clients],
  );

  const pipelineClients = useMemo(() => {
    const groups = {};
    PIPELINE_STAGES.forEach((s) => {
      groups[s.key] = [];
    });
    filtered.forEach((c) => {
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
            {t('clientCRM.backToClients')}
          </Button>
        </div>
        {showNewForm ? (
          <div className="bg-card rounded-2xl shadow-sm border border-border">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">{t('crm.newClient')}</h2>
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <NewClientForm onCreated={handleClientCreated} onCancel={handleBack} />
          </div>
        ) : (
          <ClientPanel
            client={selectedClient}
            onClientUpdated={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
          />
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
            <h1 className="text-2xl font-bold text-foreground">{t('crm.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('clientCRM.contactsCount', { total: stats.total, active: stats.active })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowNewForm(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            {t('crm.newClient')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground font-medium">{t('clientCRM.totalContacts')}</span>
            <Users className="w-4 h-4 text-blue-500 dark:text-blue-300" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{t('clientCRM.acrossAllStatuses')}</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground font-medium">{t('common.active')}</span>
            <UserCheck className="w-4 h-4 text-green-500 dark:text-green-300" />
          </div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.active}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{t('clientCRM.activeAndVip')}</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground font-medium">{t('clientCRM.vip')}</span>
            <Star className="w-4 h-4 text-purple-500 dark:text-purple-300" />
          </div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{stats.vip}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{t('clientCRM.premiumClients')}</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground font-medium">{t('clientCRM.revenue')}</span>
            <DollarSign className="w-4 h-4 text-emerald-500 dark:text-emerald-300" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            ${stats.totalRevenue.toFixed(0)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{t('clientCRM.totalCollected')}</div>
        </div>
      </div>

      {/* View toggle + search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={t('clientCRM.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm h-9"
          />
        </div>
        <div className="flex items-center border border-border rounded-lg bg-card p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            {t('clientCRM.listView')}
          </button>
          <button
            onClick={() => setViewMode('pipeline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'pipeline'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            {t('clientCRM.pipelineView')}
          </button>
        </div>
      </div>

      {/* Pipeline / Kanban Board */}
      {viewMode === 'pipeline' ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[900px]">
            {PIPELINE_STAGES.map((stage) => {
              const cards = pipelineClients[stage.key] || [];
              return (
                <div key={stage.key} className="flex-1 min-w-[140px]">
                  <div className={`rounded-lg border-2 ${stage.color} p-3 mb-3`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wide">{stage.label}</span>
                      <span className="text-xs font-bold text-muted-foreground bg-card rounded-full w-5 h-5 flex items-center justify-center">
                        {cards.length}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {cards.map((client) => (
                      <div key={client.id} onClick={() => setSelectedClientId(client.id)}>
                        <DealCard client={client} />
                      </div>
                    ))}
                    {cards.length === 0 && (
                      <div className="text-center py-6 text-[11px] text-muted-foreground italic">
                        {t('clientCRM.noContacts')}
                      </div>
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
