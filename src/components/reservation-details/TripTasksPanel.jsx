import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

import { db } from '@/lib/DbContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, Circle, Plus, AlertTriangle, Clock, Sparkles, Calendar } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { useT } from '@/lib/i18n/I18nContext';

const PRIORITY_COLORS = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  high: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  critical: 'bg-red-600 text-white dark:bg-red-700',
};

const EMPTY_FORM = { title: '', description: '', due_date: '', priority: 'medium' };

/**
 * Surfaces the operational Task engine (server/services/tasks.js) for a single
 * booking: the auto-generated milestones (final balance, rooming list, final
 * docs — tagged "Auto") plus any manually added booking tasks, with live SLA
 * badges (overdue / due soon / escalated).
 */
export default function TripTasksPanel({ bookingId, customerId, supplierId }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const queryClient = useQueryClient();

  const { data: tasks = /** @type {any} */ ([]), isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['bookingTasks', bookingId],
      queryFn: () => db.tasks.list({ booking_id: bookingId }),
      enabled: !!bookingId,
    })
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['bookingTasks', bookingId] });

  const completeMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.tasks.complete(id),
      onSuccess: () => {
        invalidate();
        showSuccess(t('tripTasksPanel.completeSuccess'));
      },
      onError: () => showError(t('tripTasksPanel.completeError')),
    })
  );

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) =>
        db.tasks.create({ ...data, booking_id: bookingId, customer_id: customerId, supplier_id: supplierId }),
      onSuccess: () => {
        invalidate();
        setOpen(false);
        setForm(EMPTY_FORM);
        showSuccess(t('tripTasksPanel.createSuccess'));
      },
      onError: () => showError(t('tripTasksPanel.createError')),
    })
  );

  const sorted = [...tasks].sort((a, b) => {
    const aDone = a.status === 'completed' || a.status === 'cancelled';
    const bDone = b.status === 'completed' || b.status === 'cancelled';
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  return (
    <Card className="p-4 sm:p-6 bg-card">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-foreground">{t('tripTasksPanel.title')}</h3>
          <p className="text-xs text-muted-foreground">{t('tripTasksPanel.subtitle')}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          {t('tripTasksPanel.addButton')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">{t('tripTasksPanel.noItemsFound')}</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((task) => {
            const isDone = task.status === 'completed' || task.status === 'cancelled';
            return (
              <div
                key={task.id}
                className={`flex items-start gap-3 p-3 rounded-lg border border-border ${isDone ? 'opacity-60' : ''}`}
              >
                <button
                  onClick={() => !isDone && completeMutation.mutate(task.id)}
                  disabled={isDone || completeMutation.isPending}
                  className="mt-0.5 flex-shrink-0"
                >
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-300" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground hover:text-blue-400" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm font-medium ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                    >
                      {task.title}
                    </span>
                    {task.template_key && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Sparkles className="w-3 h-3" />
                        {t('tripTasksPanel.auto')}
                      </Badge>
                    )}
                    <Badge className={`text-xs ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                      {t(`priority.${task.priority}`)}
                    </Badge>
                    {task.is_escalated && (
                      <Badge className="text-xs bg-red-600 text-white gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {t('tripTasksPanel.escalated')}
                      </Badge>
                    )}
                    {!task.is_escalated && task.is_overdue && (
                      <Badge className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {t('tripTasksPanel.overdue')}
                      </Badge>
                    )}
                    {!task.is_overdue && task.is_due_soon && (
                      <Badge className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 gap-1">
                        <Clock className="w-3 h-3" />
                        {t('tripTasksPanel.dueSoon')}
                      </Badge>
                    )}
                  </div>
                  {task.description && <p className="text-xs text-muted-foreground mt-1">{task.description}</p>}
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {task.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(task.due_date), 'MMM d, yyyy')}
                      </span>
                    )}
                    {task.status === 'completed' && task.completed_at && (
                      <span>
                        {t('tripTasksPanel.completedLabel', {
                          date: format(new Date(task.completed_at), 'MMM d, yyyy'),
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tripTasksPanel.dialogTitle')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(form);
            }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-1">
              <Label>{t('tripTasksPanel.titleLabel')}</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                placeholder={t('tripTasksPanel.titlePlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('priority.label')}</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('priority.low')}</SelectItem>
                    <SelectItem value="medium">{t('priority.medium')}</SelectItem>
                    <SelectItem value="high">{t('priority.high')}</SelectItem>
                    <SelectItem value="critical">{t('priority.critical')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t('tripTasksPanel.dueDateLabel')}</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t('common.description')}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder={t('tripTasksPanel.descriptionPlaceholder')}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {t('tripTasksPanel.addButton')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
