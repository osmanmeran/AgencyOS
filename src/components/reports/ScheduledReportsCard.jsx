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

const REPORT_TYPES = {
  revenue_overview: 'Revenue Overview',
  commissions: 'Commission Report',
};

const FREQUENCIES = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export default function ScheduledReportsCard() {
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
        showSuccess('Scheduled report created');
        setForm({ report_type: 'revenue_overview', frequency: 'weekly', recipients: '' });
        setShowForm(false);
        invalidate();
      },
      onError: (error) => showError('Failed to create schedule', error.message),
    })
  );

  const toggleMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, active }) => db.entities.ReportSchedule.update(id, { active }),
      onSuccess: invalidate,
      onError: (error) => showError('Failed to update schedule', error.message),
    })
  );

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.ReportSchedule.delete(id),
      onSuccess: () => {
        showSuccess('Schedule deleted');
        invalidate();
      },
      onError: (error) => showError('Failed to delete schedule', error.message),
    })
  );

  const handleCreate = () => {
    const recipients = form.recipients.trim();
    if (!recipients) {
      showError('Add at least one recipient email');
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          Scheduled Email Reports
        </h2>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" /> New Schedule
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
            placeholder="Recipient emails, comma-separated"
            value={form.recipients}
            onChange={(e) => setForm((prev) => ({ ...prev, recipients: e.target.value }))}
          />
          <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Saving...' : 'Save Schedule'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No scheduled reports yet. Create one to get a recurring summary emailed automatically.
        </p>
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
                    <Clock className="w-3 h-3" /> Last sent {format(new Date(s.last_sent_date), 'MMM d, yyyy')}
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
                  title="Delete schedule"
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
