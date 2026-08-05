import { useState, useMemo, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  User as UserIcon,
  Filter,
  ClipboardList,
  Bell,
  StickyNote,
  Loader2,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useT } from '@/lib/i18n/I18nContext';
import { db } from '@/lib/DbContext';
import { showSuccess, showError } from '@/lib/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Toggle } from '@/components/ui/toggle';
import { Badge } from '@/components/ui/badge';

const COLUMNS = [
  { id: 'pending', titleKey: 'common.pending' },
  { id: 'in_progress', titleKey: 'taskBoard.columnInProgress' },
  { id: 'completed', titleKey: 'taskBoard.columnDone' },
];

const TYPE_META = {
  task: { labelKey: 'clientTasksPanel.filterTask', Icon: ClipboardList },
  reminder: { labelKey: 'clientTasksPanel.filterReminder', Icon: Bell },
  note: { labelKey: 'clientTasksPanel.filterNote', Icon: StickyNote },
};

const EMPTY_NEW_TASK = {
  title: '',
  description: '',
  type: 'task',
  client_id: '',
  due_date: '',
  priority: 'medium',
  assigned_to_user_id: '',
};

export default function TaskBoard() {
  const { t } = useT();
  const queryClient = useQueryClient();

  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [newTask, setNewTask] = useState(EMPTY_NEW_TASK);

  const { data: allTasks = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['allTasks'],
      queryFn: () => db.tasks.list(),
    })
  );
  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clients'],
      queryFn: () => db.entities.Client.list(),
    })
  );
  const { data: currentUser } = /** @type {any} */ (
    useQuery({
      queryKey: ['me'],
      queryFn: () => db.auth.me(),
    })
  );
  const { data: staffUsers = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['staffUsers'],
      queryFn: async () => {
        const users = await db.auth.users();
        return users.filter((u) => u.is_active && ['admin', 'manager', 'agent'].includes(u.user_tier));
      },
    })
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['allTasks'] });

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: /** @type {any} */ (data) => db.tasks.create({ ...data, customer_id: data.client_id || undefined }),
      onSuccess: () => {
        invalidate();
        setNewTaskOpen(false);
        setNewTask({ ...EMPTY_NEW_TASK, assigned_to_user_id: currentUser?.id || '' });
        showSuccess(t('taskBoard.createSuccess'));
      },
      onError: () => showError(t('taskBoard.createError')),
    })
  );

  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ payload) => db.entities.Task.update(payload.id, payload.data),
      onSuccess: () => {
        invalidate();
        setEditOpen(false);
        setEditingTask(null);
        showSuccess(t('taskBoard.updateSuccess'));
      },
      onError: () => showError(t('taskBoard.updateError')),
    })
  );

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: /** @type {any} */ (id) => db.entities.Task.delete(id),
      onSuccess: () => {
        invalidate();
        setEditOpen(false);
        setEditingTask(null);
        showSuccess(t('taskBoard.deleteSuccess'));
      },
      onError: () => showError(t('taskBoard.deleteError')),
    })
  );

  const assigneeName = useMemo(() => {
    const map = {};
    staffUsers.forEach((u) => {
      map[u.id] = u.name || u.email;
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
    // Cancelled tasks are effectively archived — never shown on the board
    // (there's no column for them, and they'd otherwise fall into "Pending").
    const active = allTasks.filter((task) => task.status !== 'cancelled');
    if (!myTasksOnly || !currentUser) return active;
    return active.filter((task) => task.assigned_to_user_id === currentUser.id || task.created_by === currentUser.id);
  }, [allTasks, myTasksOnly, currentUser]);

  const grouped = useMemo(() => {
    const g = { pending: [], in_progress: [], completed: [] };
    visibleTasks.forEach((task) => {
      (g[task.status] || g.pending).push(task);
    });
    return g;
  }, [visibleTasks]);

  function openEdit(task) {
    setEditingTask(task);
    setEditOpen(true);
  }

  function handleDragEnd(result) {
    const { draggableId, destination } = result;
    if (!destination) return;
    const taskId = draggableId;
    const newStatus = destination.droppableId;
    const task = allTasks.find((tt) => String(tt.id) === String(taskId));
    if (!task || task.status === newStatus) return;
    const data = { ...task, status: newStatus };
    if (newStatus === 'completed') data.completed_at = new Date().toISOString();
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

      <DragDropContext onDragEnd={handleDragEnd}>
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
      </DragDropContext>

      <NewTaskDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        newTask={newTask}
        setNewTask={setNewTask}
        clients={clients}
        staffUsers={staffUsers}
        currentUserId={currentUser?.id || ''}
        onCreate={(data) => createMutation.mutate(data)}
        creating={createMutation.isPending}
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
          saving={updateMutation.isPending}
          deleting={deleteMutation.isPending}
          t={t}
        />
      )}
    </div>
  );
}

function Column({ id, title, tasks, clientName, assigneeName, onEdit, onDelete, TYPE_META, t }) {
  return (
    <Droppable droppableId={id}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`bg-muted/40 rounded-xl p-3 min-h-[200px] transition-colors ${snapshot.isDraggingOver ? 'ring-2 ring-primary/50' : ''}`}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">{title}</h2>
            <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">{tasks.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {tasks.map((task, index) => (
              <TaskCardView
                key={task.id}
                task={task}
                index={index}
                clientName={clientName}
                assigneeName={assigneeName}
                onEdit={() => onEdit(task)}
                onDelete={() => onDelete(task)}
                TYPE_META={TYPE_META}
                t={t}
              />
            ))}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
}

function TaskCardView({ task, index, clientName, assigneeName, onEdit, onDelete, TYPE_META, t }) {
  const meta = TYPE_META[task.type] || TYPE_META.task;
  const TypeIcon = meta.Icon;

  return (
    <Draggable draggableId={String(task.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={/** @type {any} */ (provided.draggableProps.style)}
          className={`group relative bg-card border border-border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing ${
            snapshot.isDragging ? 'opacity-50' : ''
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

          {task.booking_id ? (
            <Link
              to={createPageUrl(`ReservationDetails?id=${task.booking_id}`)}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-foreground mt-1 break-words hover:underline block"
            >
              {task.title}
            </Link>
          ) : (
            <p className="text-sm font-medium text-foreground mt-1 break-words">{task.title}</p>
          )}
          {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}

          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {task.template_key && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                {t('tripTasksPanel.auto')}
              </Badge>
            )}
            {task.is_escalated && (
              <Badge className="text-[10px] bg-red-600 text-white gap-1">
                <AlertTriangle className="w-2.5 h-2.5" />
                {t('tripTasksPanel.escalated')}
              </Badge>
            )}
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
            {clientName[task.customer_id] && (
              <Badge variant="secondary" className="text-[10px]">
                {clientName[task.customer_id]}
              </Badge>
            )}
          </div>

          {task.assigned_to_user_id && (
            <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground">
              <UserIcon className="w-3 h-3" />
              <span>{assigneeName[task.assigned_to_user_id] || task.assigned_to_user_id}</span>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

function NewTaskDialog({
  open,
  onOpenChange,
  newTask,
  setNewTask,
  clients,
  staffUsers,
  currentUserId,
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
                  <SelectItem value="critical">{t('priority.critical')}</SelectItem>
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
              value={newTask.assigned_to_user_id || currentUserId || 'none'}
              onValueChange={(v) => setNewTask({ ...newTask, assigned_to_user_id: v === 'none' ? '' : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('taskBoard.selectAssigneePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('taskBoard.unassigned')}</SelectItem>
                {staffUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
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
    client_id: task.customer_id || '',
    due_date: task.due_date || '',
    priority: task.priority || 'medium',
    assigned_to_user_id: task.assigned_to_user_id || '',
    status: task.status || 'pending',
    completed_at: task.completed_at || '',
  }));

  useEffect(() => {
    setForm({
      title: task.title || '',
      description: task.description || '',
      type: task.type || 'task',
      client_id: task.customer_id || '',
      due_date: task.due_date || '',
      priority: task.priority || 'medium',
      assigned_to_user_id: task.assigned_to_user_id || '',
      status: task.status || 'pending',
      completed_at: task.completed_at || '',
    });
  }, [task]);

  function handleSave() {
    const { client_id, ...rest } = form;
    const data = { ...rest, customer_id: client_id || null };
    if (form.status === 'completed' && task.status !== 'completed') {
      data.completed_at = new Date().toISOString();
    } else if (form.status !== 'completed') {
      data.completed_at = '';
    }
    onSave(data);
  }

  const isAuto = !!task.template_key;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('taskBoard.editTaskDialogTitle')}
            {isAuto && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                {t('tripTasksPanel.auto')}
              </Badge>
            )}
          </DialogTitle>
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
                  <SelectItem value="critical">{t('priority.critical')}</SelectItem>
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
                value={form.assigned_to_user_id || 'none'}
                onValueChange={(v) => setForm({ ...form, assigned_to_user_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('taskBoard.selectAssigneePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('taskBoard.unassigned')}</SelectItem>
                  {staffUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
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
                  <SelectItem value="completed">{t('taskBoard.columnDone')}</SelectItem>
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
