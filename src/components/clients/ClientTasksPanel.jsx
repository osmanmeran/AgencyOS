import { db } from '@/lib/DbContext';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, CheckCircle2, Circle, Bell, StickyNote, ClipboardList, Trash2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { showError } from '@/lib/toast';
import { useT } from '@/lib/i18n/I18nContext';

const TYPE_ICONS = {
  task: { icon: ClipboardList, color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  reminder: { icon: Bell, color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
  note: { icon: StickyNote, color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
};

const TYPE_LABEL_KEYS = {
  task: 'clientTasksPanel.filterTask',
  reminder: 'clientTasksPanel.filterReminder',
  note: 'clientTasksPanel.filterNote',
};

const FILTER_LABEL_KEYS = {
  all: 'common.all',
  task: 'clientTasksPanel.filterTask',
  reminder: 'clientTasksPanel.filterReminder',
  note: 'clientTasksPanel.filterNote',
  pending: 'common.pending',
  in_progress: 'clientTasksPanel.filterInProgress',
  done: 'clientTasksPanel.filterDone',
};

const PRIORITY_COLORS = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  high: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  critical: 'bg-red-600 text-white dark:bg-red-700',
};

const EMPTY_FORM = {
  title: '',
  description: '',
  type: 'task',
  due_date: '',
  priority: 'medium',
  assigned_to_user_id: '',
};

/**
 * Client-scoped personal tasks/reminders/notes — backed by the Task entity
 * (server/services/tasks.js), filtered to manual entries (no `template_key`)
 * so the auto-generated, SLA-tracked booking tasks shown in
 * TripTasksPanel/Dashboard's "My Tasks" don't get mixed in here without
 * their SLA badges.
 */
export default function ClientTasksPanel({ clientId }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [deletingTask, setDeletingTask] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const queryClient = useQueryClient();

  const { data: allTasks = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clientTasks', clientId],
      queryFn: () => db.tasks.list({ customer_id: clientId, sort: '-created_date' }),
      enabled: !!clientId,
    })
  );

  const tasks = useMemo(() => allTasks.filter((task) => !task.template_key), [allTasks]);

  const { data: staffUsers = /** @type {any} */ ([]) } = useQuery({
    queryKey: ['staffUsers'],
    queryFn: () => db.auth.users(),
  });

  const assigneeName = /** @type {any} */ (
    useMemo(() => {
      const map = {};
      staffUsers.forEach((u) => {
        map[u.id] = u.name || u.email;
      });
      return map;
    }, [staffUsers])
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['clientTasks', clientId] });

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) =>
        db.tasks.create({ ...data, assigned_to_user_id: data.assigned_to_user_id || undefined, customer_id: clientId }),
      onSuccess: () => {
        invalidate();
        setOpen(false);
        setForm(EMPTY_FORM);
      },
      onError: (/** @type {any} */ err) => showError(t('clientTasksPanel.createError'), err.message),
    })
  );

  const toggleMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ task) =>
        task.status === 'completed'
          ? db.entities.Task.update(task.id, { status: 'pending', completed_at: null })
          : db.tasks.complete(task.id),
      onSuccess: invalidate,
      onError: (/** @type {any} */ err) => showError(t('clientTasksPanel.updateError'), err.message),
    })
  );

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.Task.delete(id),
      onSuccess: () => {
        invalidate();
        setDeletingTask(null);
      },
      onError: (/** @type {any} */ err) => showError(t('clientTasksPanel.deleteError'), err.message),
    })
  );

  const filtered =
    filter === 'all'
      ? tasks
      : tasks.filter(
          (t) =>
            t.type === filter ||
            (filter === 'pending' && t.status === 'pending') ||
            (filter === 'in_progress' && t.status === 'in_progress') ||
            (filter === 'done' && t.status === 'completed'),
        );

  const pending = tasks.filter((t) => t.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {['all', 'task', 'reminder', 'note', 'pending', 'in_progress', 'done'].map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              className={filter === f ? 'bg-blue-600' : ''}
              onClick={() => setFilter(f)}
            >
              {t(FILTER_LABEL_KEYS[f])}
              {f === 'pending' && pending > 0 && (
                <span className="ml-1 bg-orange-500 text-white text-xs rounded-full px-1.5">{pending}</span>
              )}
            </Button>
          ))}
        </div>
        <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-1" />
          {t('clientTasksPanel.addButton')}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center bg-card">
          <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">{t('clientTasksPanel.noItemsFound')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => {
            const cfg = TYPE_ICONS[task.type] || TYPE_ICONS.task;
            const labelKey = TYPE_LABEL_KEYS[task.type] || TYPE_LABEL_KEYS.task;
            const Icon = cfg.icon;
            const isDone = task.status === 'completed';
            return (
              <Card key={task.id} className={`p-4 bg-card border transition-all ${isDone ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <button onClick={() => toggleMutation.mutate(task)} className="mt-0.5 flex-shrink-0">
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
                      <Badge className={`text-xs ${cfg.color}`}>
                        <Icon className="w-3 h-3 mr-1" />
                        {t(labelKey)}
                      </Badge>
                      <Badge className={`text-xs ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                        {t(`priority.${task.priority}`)}
                      </Badge>
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground mt-1">{task.description}</p>}
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(task.due_date), 'MMM d, yyyy')}
                        </span>
                      )}
                      {task.assigned_to_user_id && (
                        <span>
                          {t('clientTasksPanel.assignedLabel', {
                            name: assigneeName[task.assigned_to_user_id] || task.assigned_to_user_id,
                          })}
                        </span>
                      )}
                      <span>{format(new Date(task.created_date), 'MMM d')}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setDeletingTask(task)}
                    aria-label={t('common.delete')}
                    className="text-muted-foreground hover:text-red-500 dark:hover:text-red-300 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deletingTask} onOpenChange={(isOpen) => !isOpen && setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('common.confirmDeleteBody', { name: deletingTask?.title || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deletingTask.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('clientTasksPanel.dialogTitle')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(form);
            }}
            className="space-y-4 mt-2"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>{t('clientTasksPanel.titleLabel')}</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                  placeholder={t('clientTasksPanel.titlePlaceholder')}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('clientTasksPanel.typeLabel')}</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">{t('clientTasksPanel.filterTask')}</SelectItem>
                    <SelectItem value="reminder">{t('clientTasksPanel.filterReminder')}</SelectItem>
                    <SelectItem value="note">{t('clientTasksPanel.filterNote')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t('clientTasksPanel.dueDateLabel')}</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('clientTasksPanel.assignToLabel')}</Label>
                <Select
                  value={form.assigned_to_user_id || '__unassigned__'}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, assigned_to_user_id: v === '__unassigned__' ? '' : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned__">{t('clientTasksPanel.unassigned')}</SelectItem>
                    {staffUsers
                      .filter((u) => u.is_active && ['admin', 'manager', 'agent'].includes(u.user_tier))
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || u.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label>{t('common.description')}</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder={t('clientTasksPanel.descriptionPlaceholder')}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {t('clientTasksPanel.addButton')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
