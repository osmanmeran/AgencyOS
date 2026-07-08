import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Plus, Trash2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { showSuccess, showError } from '@/lib/toast';
import { useT } from '@/lib/i18n/I18nContext';

export default function ScheduledReportsCard() {
  const { t } = useT();
  const REPORT_TYPES = {
    revenue_overview: t('scheduledReportsCard.reportTypeRevenue'),
    commissions: t('scheduledReportsCard.reportTypeCommissions'),
  };

  const FREQUENCIES = {
    daily: t('scheduledReportsCard.freqDaily'),
    weekly: t('scheduledReportsCard.freqWeekly'),
    monthly: t('scheduledReportsCard.freqMonthly'),
  };
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ report_type: 'revenue_overview', frequency: 'weekly', recipients: '' });

  const { data: schedules = /** @type {any} */ ([]), isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['reportSchedules'],
      queryFn: () => db.entities.ReportSchedule.list('-created_date'),
    })
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['reportSchedules'] });

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.ReportSchedule.create({ ...data, active: true }),
      onSuccess: () => {
        showSuccess(t('scheduledReportsCard.createSuccess'));
        setForm({ report_type: 'revenue_overview', frequency: 'weekly', recipients: '' });
        setShowForm(false);
        invalidate();
      },
      onError: (error) => showError(t('scheduledReportsCard.createError'), error.message),
    })
  );

  const toggleMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, active }) => db.entities.ReportSchedule.update(id, { active }),
      onSuccess: invalidate,
      onError: (error) => showError(t('scheduledReportsCard.updateError'), error.message),
    })
  );

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.ReportSchedule.delete(id),
      onSuccess: () => {
        showSuccess(t('scheduledReportsCard.deleteSuccess'));
        invalidate();
      },
      onError: (error) => showError(t('scheduledReportsCard.deleteError'), error.message),
    })
  );

  const handleCreate = () => {
    const recipients = form.recipients.trim();
    if (!recipients) {
      showError(t('scheduledReportsCard.recipientRequired'));
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          {t('scheduledReportsCard.title')}
        </h2>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" /> {t('scheduledReportsCard.newSchedule')}
        </Button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-muted rounded-lg border border-border space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              value={form.report_type}
              onValueChange={(val) => setForm((prev) => ({ ...prev, report_type: val }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REPORT_TYPES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={form.frequency} onValueChange={(val) => setForm((prev) => ({ ...prev, frequency: val }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FREQUENCIES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder={t('scheduledReportsCard.recipientsPlaceholder')}
            value={form.recipients}
            onChange={(e) => setForm((prev) => ({ ...prev, recipients: e.target.value }))}
          />
          <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? t('common.saving') : t('scheduledReportsCard.saveSchedule')}
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">{t('scheduledReportsCard.noSchedulesYet')}</p>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-lg border border-border"
            >
              <div>
                <div className="font-medium text-sm text-foreground">
                  {REPORT_TYPES[s.report_type] || s.report_type} &middot; {FREQUENCIES[s.frequency] || s.frequency}
                </div>
                <div className="text-xs text-muted-foreground">{s.recipients}</div>
                {s.last_sent_date && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />{' '}
                    {t('scheduledReportsCard.lastSent', { date: format(new Date(s.last_sent_date), 'MMM d, yyyy') })}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={!!s.active}
                  onCheckedChange={(checked) => toggleMutation.mutate({ id: s.id, active: checked })}
                />
                <button
                  onClick={() => deleteMutation.mutate(s.id)}
                  className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"
                  title={t('scheduledReportsCard.deleteScheduleTitle')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
