const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], list:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lightbulb, Star, Bug, Heart } from 'lucide-react';

const STATUS_STYLES = {
  open: 'bg-slate-100 text-slate-700 border-slate-300',
  under_review: 'bg-blue-100 text-blue-700 border-blue-300',
  planned: 'bg-amber-100 text-amber-700 border-amber-300',
  implemented: 'bg-green-100 text-green-700 border-green-300',
  declined: 'bg-red-100 text-red-700 border-red-300',
};

const TYPE_ICONS = {
  feature: Star,
  bug: Bug,
  improvement: Heart,
  other: Lightbulb,
};

function getToken() {
  try { const s = localStorage.getItem('b44_user'); return s ? JSON.parse(s).token : null; } catch { return null; }
}

async function api(path, opts = {}) {
  const token = getToken();
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
    ...opts,
  });
  return res.json();
}

export default function SuggestionsManager() {
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();

  const { data: suggestions = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['suggestions'],
    queryFn: async () => {
      try {
        const all = await db.entities.Suggestion.list();
        return all;
      } catch {
        const data = await api('/api/suggestions');
        if (data.error) throw new Error(data.error);
        return data;
      }
    },
  }));

  const updateStatus = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ { id, /** @type {any} */ status }) => {
      try {
        const item = suggestions.find(s => s.id === id);
        if (item) await db.entities.Suggestion.update(id, { ...item, status });
        else await api(`/api/suggestions/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      } catch (err) { throw err; }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suggestions'] }),
  }));

  const filtered = filterStatus === 'all' ? suggestions : suggestions.filter(s => s.status === filterStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-amber-100 p-2.5 rounded-xl">
          <Lightbulb className="w-6 h-6 text-amber-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Suggestions & Feedback</h1>
          <p className="text-sm text-slate-500">Review and manage user-submitted suggestions</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'open', 'under_review', 'planned', 'implemented', 'declined'].map(s => (
          <Button key={s} variant={filterStatus === s ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus(s)}
            className={filterStatus === s ? 'bg-amber-600' : ''}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
            <span className="ml-1.5 text-xs opacity-70">({s === 'all' ? suggestions.length : suggestions.filter(x => x.status === s).length})</span>
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <Lightbulb className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No suggestions yet</p>
          <p className="text-sm mt-1">Suggestions from users will appear here</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => {
            const TypeIcon = TYPE_ICONS[s.type] || Lightbulb;
            return (
              <Card key={s.id} className="p-5 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-100 flex-shrink-0 mt-0.5">
                      <TypeIcon className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{s.title}</h3>
                        <Badge className={STATUS_STYLES[s.status] || 'bg-slate-100'}>
                          {s.status?.replace('_', ' ')}
                        </Badge>
                      </div>
                      {s.description && <p className="text-sm text-slate-600 mt-1.5">{s.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                        <span>{s.user_name || s.user_email || 'Anonymous'}</span>
                        {s.created_date && <span>{new Date(s.created_date).toLocaleDateString()}</span>}
                        <Badge className="bg-slate-100 text-slate-600 text-[10px] capitalize">{s.type}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Select
                      value={s.status || 'open'}
                      onValueChange={v => updateStatus.mutate({ id: s.id, status: v })}
                    >
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="under_review">Under Review</SelectItem>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="implemented">Implemented</SelectItem>
                        <SelectItem value="declined">Declined</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
