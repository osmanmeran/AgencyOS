import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lightbulb, Star, Bug, Heart } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';
import { getCsrfToken } from '@/lib/csrf';

const STATUS_STYLES = {
  open: 'bg-muted text-foreground border-border',
  under_review: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800',
  planned:
    'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  implemented:
    'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800',
  declined: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800',
};

const TYPE_ICONS = {
  feature: Star,
  bug: Bug,
  improvement: Heart,
  other: Lightbulb,
};

async function api(path, opts = {}) {
  const csrfToken = getCsrfToken();
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...opts.headers,
    },
    credentials: 'include',
    ...opts,
  });
  return res.json();
}

export default function SuggestionsManager() {
  const { t } = useT();
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();

  const { data: suggestions = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['suggestions'],
      queryFn: async () => {
        const data = await api('/api/suggestions');
        if (data.error) throw new Error(data.error);
        return data;
      },
    })
  );

  const updateStatus = /** @type {any} */ (
    useMutation({
      mutationFn: async (/** @type {any} */ { id, /** @type {any} */ status }) => {
        const data = await api(`/api/suggestions/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        if (data.error) throw new Error(data.error);
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suggestions'] }),
    })
  );

  const filtered = filterStatus === 'all' ? suggestions : suggestions.filter((s) => s.status === filterStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-amber-100 dark:bg-amber-900/40 p-2.5 rounded-xl">
          <Lightbulb className="w-6 h-6 text-amber-700 dark:text-amber-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('suggestionsManager.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('suggestionsManager.subtitle')}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'open', 'under_review', 'planned', 'implemented', 'declined'].map((s) => (
          <Button
            key={s}
            variant={filterStatus === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus(s)}
            className={filterStatus === s ? 'bg-amber-600' : ''}
          >
            {s === 'all' ? t('common.all') : t(`suggestionsManager.status.${s}`)}
            <span className="ml-1.5 text-xs opacity-70">
              ({s === 'all' ? suggestions.length : suggestions.filter((x) => x.status === s).length})
            </span>
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Lightbulb className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">{t('suggestionsManager.noSuggestionsYet')}</p>
          <p className="text-sm mt-1">{t('suggestionsManager.noSuggestionsBody')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const TypeIcon = TYPE_ICONS[s.type] || Lightbulb;
            return (
              <Card key={s.id} className="p-5 bg-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-muted flex-shrink-0 mt-0.5">
                      <TypeIcon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{s.title}</h3>
                        <Badge className={STATUS_STYLES[s.status] || 'bg-muted'}>
                          {STATUS_STYLES[s.status] ? t(`suggestionsManager.status.${s.status}`) : s.status}
                        </Badge>
                      </div>
                      {s.description && <p className="text-sm text-muted-foreground mt-1.5">{s.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{s.user_name || s.user_email || t('suggestionsManager.anonymous')}</span>
                        {s.created_date && <span>{new Date(s.created_date).toLocaleDateString()}</span>}
                        <Badge className="bg-muted text-muted-foreground text-[10px] capitalize">{s.type}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Select
                      value={s.status || 'open'}
                      onValueChange={(v) => updateStatus.mutate({ id: s.id, status: v })}
                    >
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">{t('suggestionsManager.status.open')}</SelectItem>
                        <SelectItem value="under_review">{t('suggestionsManager.status.under_review')}</SelectItem>
                        <SelectItem value="planned">{t('suggestionsManager.status.planned')}</SelectItem>
                        <SelectItem value="implemented">{t('suggestionsManager.status.implemented')}</SelectItem>
                        <SelectItem value="declined">{t('suggestionsManager.status.declined')}</SelectItem>
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
