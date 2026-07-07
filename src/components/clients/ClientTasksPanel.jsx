import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, CheckCircle2, Circle, Bell, StickyNote, ClipboardList, Trash2, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const TYPE_CONFIG = {
  task: {
    icon: ClipboardList,
    color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    label: 'Task',
  },
  reminder: {
    icon: Bell,
    color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    label: 'Reminder',
  },
  note: {
    icon: StickyNote,
    color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    label: 'Note',
  },
};

const PRIORITY_COLORS = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  high: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
};

export default function ClientTasksPanel({ clientId }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'task',
    due_date: '',
    priority: 'medium',
    assigned_to: '',
  });
  const queryClient = useQueryClient();

  const { data: tasks = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clientTasks', clientId],
      queryFn: () => db.entities.ClientTask.filter({ client_id: clientId }, '-created_date'),
      enabled: !!clientId,
    })
  );

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.ClientTask.create({ ...data, client_id: clientId }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['clientTasks', clientId] });
        setOpen(false);
        setForm({ title: '', description: '', type: 'task', due_date: '', priority: 'medium', assigned_to: '' });
      },
    })
  );

  const toggleMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ task) =>
        db.entities.ClientTask.update(task.id, { status: task.status === 'done' ? 'pending' : 'done' }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientTasks', clientId] }),
    })
  );

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.ClientTask.delete(id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientTasks', clientId] }),
    })
  );

  const filtered =
    filter === 'all'
      ? tasks
      : tasks.filter(
          (t) =>
            t.type === filter ||
            (filter === 'pending' && t.status === 'pending') ||
            (filter === 'done' && t.status === 'done'),
        );

  const pending = tasks.filter((t) => t.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {['all', 'task', 'reminder', 'note', 'pending', 'done'].map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              className={filter === f ? 'bg-blue-600' : ''}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'pending' && pending > 0 && (
                <span className="ml-1 bg-orange-500 text-white text-xs rounded-full px-1.5">{pending}</span>
              )}
            </Button>
          ))}
        </div>
        <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center bg-card">
          <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No items found</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => {
            const cfg = TYPE_CONFIG[task.type] || TYPE_CONFIG.task;
            const Icon = cfg.icon;
            const isDone = task.status === 'done';
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
                        {cfg.label}
                      </Badge>
                      <Badge className={`text-xs ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</Badge>
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground mt-1">{task.description}</p>}
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(task.due_date), 'MMM d, yyyy')}
                        </span>
                      )}
                      {task.assigned_to && <span>Assigned: {task.assigned_to}</span>}
                      <span>{format(new Date(task.created_date), 'MMM d')}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(task.id)}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Task / Reminder / Note</DialogTitle>
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
                <Label>Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                  placeholder="Task title..."
                />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="reminder">Reminder</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Assign To (email)</Label>
                <Input
                  value={form.assigned_to}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                  placeholder="team@member.com"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Additional details..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={createMutation.isPending}>
                Add
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
