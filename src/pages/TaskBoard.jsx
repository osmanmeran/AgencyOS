import { useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, User as UserIcon, Filter, ClipboardList, Bell, StickyNote, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db } from '../lib/db';
import { useToast } from '../hooks/useToast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Toggle } from '../components/ui/toggle';
import { Badge } from '../components/ui/badge';

const COLUMNS = [
  { id: 'pending', titleKey: 'common.pending' },
  { id: 'in_progress', titleKey: 'taskBoard.columnInProgress' },
  { id: 'done', titleKey: 'taskBoard.columnDone' },
];

const TYPE_META = {
  task: { labelKey: 'clientTasksPanel.filterTask', Icon: ClipboardList },
  reminder: { labelKey: 'clientTasksPanel.filterReminder', Icon: Bell },
  note: { labelKey: 'clientTasksPanel.filterNote', Icon: StickyNote },
};

export default function TaskBoard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    type: 'task',
    client_id: '',
    due_date: '',
    priority: 'medium',
    assigned_to: '',
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: clientTasks = [] } = useQuery({
    queryKey: ['clientTasks'],
    queryFn: () => db.entities.ClientTask.list(),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => db.entities.Client.list(),
  });
  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => db.auth.me(),
  });
  const { data: staffUsers = [] } = useQuery({
    queryKey: ['staffUsers'],
    queryFn: async () => {
      const users = await db.auth.users();
      return users.filter((u) => u.is_active && ['admin', 'manager', 'agent'].includes(u.user_tier));
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => db.entities.ClientTask.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientTasks']);
      setNewTaskOpen(false);
      setNewTask({
        title: '',
        description: '',
        type: 'task',
        client_id: '',
        due_date: '',
        priority: 'medium',
        assigned_to: currentUser?.email || '',
      });
      toast({ title: t('taskBoard.createSuccess') });
    },
    onError: () => toast({ title: t('taskBoard.createError'), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => db.entities.ClientTask.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientTasks']);
      setEditOpen(false);
      setEditingTask(null);
      toast({ title: t('taskBoard.updateSuccess') });
    },
    onError: () => toast({ title: t('taskBoard.updateError'), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.ClientTask.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientTasks']);
      setEditOpen(false);
      setEditingTask(null);
      toast({ title: t('taskBoard.deleteSuccess') });
    },
    onError: () => toast({ title: t('taskBoard.deleteError'), variant: 'destructive' }),
  });

  const assigneeName = useMemo(() => {
    const map = {};
    staffUsers.forEach((u) => {
      map[u.email] = u.name || u.email;
    });
    return map;
  }, [staffUsers]);

  const clientName = useMemo(() => {
    const map = {};
    clients.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [clients]);

  const visibleTasks = useMemo(() => {
    if (!myTasksOnly || !currentUser) return clientTasks;
    return clientTasks.filter(
      (task) => task.assigned_to === currentUser.email || task.created_by_id === currentUser.id,
    );
  }, [clientTasks, myTasksOnly, currentUser]);

  const grouped = useMemo(() => {
    const g = { pending: [], in_progress: [], done: [] };
    visibleTasks.forEach((task) => {
      (g[task.status] || g.pending).push(task);
    });
    return g;
  }, [visibleTasks]);

  function openEdit(task) {
    setEditingTask(task);
    setEditOpen(true);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id;
    const newStatus = over.id;
    const task = clientTasks.find((tt) => tt.id === taskId);
    if (!task || task.status === newStatus) return;
    const data = { ...task, status: newStatus };
    if (newStatus === 'done') data.completed_at = new Date().toISOString();
    else data.completed_at = '';
    updateMutation.mutate({ id: taskId, data });
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-foreground" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t('taskBoard.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('taskBoard.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Toggle
            aria-label={t('taskBoard.myTasks')}
            pressed={myTasksOnly}
            onPressedChange={setMyTasksOnly}
            className="border border-border"
          >
            <Filter className="w-4 h-4 mr-1" />
            {t('taskBoard.myTasks')}
          </Toggle>
          <Button onClick={() => setNewTaskOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            {t('taskBoard.newTask')}
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              title={t(col.titleKey)}
              tasks={grouped[col.id]}
              clientName={clientName}
              assigneeName={assigneeName}
              onEdit={openEdit}
              onDelete={(task) => deleteMutation.mutate(task.id)}
              TYPE_META={TYPE_META}
              t={t}
            />
          ))}
        </div>
      </DndContext>

      <NewTaskDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        newTask={newTask}
        setNewTask={setNewTask}
        clients={clients}
        staffUsers={staffUsers}
        currentUserEmail={currentUser?.email || ''}
        onCreate={(data) => createMutation.mutate(data)}
        creating={createMutation.isLoading}
        t={t}
      />

      {editingTask && (
        <EditTaskDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          task={editingTask}
          clients={clients}
          staffUsers={staffUsers}
          onSave={(data) => updateMutation.mutate({ id: editingTask.id, data })}
          onDelete={() => deleteMutation.mutate(editingTask.id)}
          saving={updateMutation.isLoading}
          deleting={deleteMutation.isLoading}
          t={t}
        />
      )}
    </div>
  );
}

function Column({ id, title, tasks, clientName, assigneeName, onEdit, onDelete, TYPE_META, t }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`bg-muted/40 rounded-xl p-3 min-h-[200px] transition-colors ${isOver ? 'ring-2 ring-primary/50' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">{tasks.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskCardView
            key={task.id}
            task={task}
            clientName={clientName}
            assigneeName={assigneeName}
            onEdit={() => onEdit(task)}
            onDelete={() => onDelete(task)}
            TYPE_META={TYPE_META}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function TaskCardView({ task, clientName, assigneeName, onEdit, onDelete, TYPE_META, t }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });
  const meta = TYPE_META[task.type] || TYPE_META.task;
  const TypeIcon = meta.Icon;
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative bg-card border border-border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <TypeIcon className="w-3.5 h-3.5" />
          <span>{t(meta.labelKey)}</span>
        </div>
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 text-muted-foreground hover:text-foreground"
            aria-label={t('taskBoard.editTask')}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 text-muted-foreground hover:text-destructive"
            aria-label={t('common.delete')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <p className="text-sm font-medium text-foreground mt-1 break-words">{task.title}</p>
      {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {task.priority && (
          <Badge variant="outline" className="text-[10px] capitalize">
            {t(`priority.${task.priority}`)}
          </Badge>
        )}
        {task.due_date && (
          <Badge variant="outline" className="text-[10px]">
            {task.due_date}
          </Badge>
        )}
        {clientName[task.client_id] && (
          <Badge variant="secondary" className="text-[10px]">
            {clientName[task.client_id]}
          </Badge>
        )}
      </div>

      {task.assigned_to && (
        <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground">
          <UserIcon className="w-3 h-3" />
          <span>{assigneeName[task.assigned_to] || task.assigned_to}</span>
        </div>
      )}
    </div>
  );
}

function NewTaskDialog({
  open,
  onOpenChange,
  newTask,
  setNewTask,
  clients,
  staffUsers,
  currentUserEmail,
  onCreate,
  creating,
  t,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('taskBoard.newTaskDialogTitle')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label>{t('taskBoard.taskTitlePlaceholder')}</Label>
            <Input
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder={t('taskBoard.taskTitlePlaceholder')}
            />
          </div>
          <div>
            <Label>{t('taskBoard.descriptionPlaceholder')}</Label>
            <Textarea
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              placeholder={t('taskBoard.descriptionPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('taskBoard.typeLabel')}</Label>
              <Select value={newTask.type} onValueChange={(v) => setNewTask({ ...newTask, type: v })}>
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
            <div>
              <Label>{t('priority.label')}</Label>
              <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('taskBoard.selectClientPlaceholder')}</Label>
              <Select
                value={newTask.client_id || 'none'}
                onValueChange={(v) => setNewTask({ ...newTask, client_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('taskBoard.selectClientPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('taskBoard.noClient')}</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('taskBoard.dueDatePlaceholder')}</Label>
              <Input
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>{t('taskBoard.assigneeLabel')}</Label>
            <Select
              value={newTask.assigned_to || currentUserEmail || 'none'}
              onValueChange={(v) => setNewTask({ ...newTask, assigned_to: v === 'none' ? '' : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('taskBoard.selectAssigneePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('taskBoard.unassigned')}</SelectItem>
                {staffUsers.map((u) => (
                  <SelectItem key={u.id} value={u.email}>
                    {u.name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={creating || !newTask.title.trim()} onClick={() => onCreate(newTask)}>
            {creating && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {t('taskBoard.createTask')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditTaskDialog({ open, onOpenChange, task, clients, staffUsers, onSave, onDelete, saving, deleting, t }) {
  const [form, setForm] = useState(() => ({
    title: task.title || '',
    description: task.description || '',
    type: task.type || 'task',
    client_id: task.client_id || '',
    due_date: task.due_date || '',
    priority: task.priority || 'medium',
    assigned_to: task.assigned_to || '',
    status: task.status || 'pending',
    completed_at: task.completed_at || '',
  }));

  useEffect(() => {
    setForm({
      title: task.title || '',
      description: task.description || '',
      type: task.type || 'task',
      client_id: task.client_id || '',
      due_date: task.due_date || '',
      priority: task.priority || 'medium',
      assigned_to: task.assigned_to || '',
      status: task.status || 'pending',
      completed_at: task.completed_at || '',
    });
  }, [task]);

  function handleSave() {
    const data = { ...form };
    if (form.status === 'done' && task.status !== 'done') {
      data.completed_at = new Date().toISOString();
    } else if (form.status !== 'done') {
      data.completed_at = '';
    }
    onSave(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('taskBoard.editTaskDialogTitle')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label>{t('taskBoard.taskTitlePlaceholder')}</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>{t('taskBoard.descriptionPlaceholder')}</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('taskBoard.typeLabel')}</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
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
            <div>
              <Label>{t('priority.label')}</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('taskBoard.selectClientPlaceholder')}</Label>
              <Select
                value={form.client_id || 'none'}
                onValueChange={(v) => setForm({ ...form, client_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('taskBoard.selectClientPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('taskBoard.noClient')}</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('taskBoard.dueDatePlaceholder')}</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('taskBoard.assigneeLabel')}</Label>
              <Select
                value={form.assigned_to || 'none'}
                onValueChange={(v) => setForm({ ...form, assigned_to: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('taskBoard.selectAssigneePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('taskBoard.unassigned')}</SelectItem>
                  {staffUsers.map((u) => (
                    <SelectItem key={u.id} value={u.email}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('taskBoard.statusLabel')}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t('common.pending')}</SelectItem>
                  <SelectItem value="in_progress">{t('taskBoard.columnInProgress')}</SelectItem>
                  <SelectItem value="done">{t('taskBoard.columnDone')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="flex items-center justify-between">
          <Button variant="destructive" onClick={onDelete} disabled={deleting}>
            {deleting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {t('common.delete')}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={saving || !form.title.trim()} onClick={handleSave}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {t('common.save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
