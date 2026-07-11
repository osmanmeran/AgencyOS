import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListCheck, Plus, MoreHorizontal, Calendar as CalendarIcon } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { format } from 'date-fns';
import { useT } from '@/lib/i18n/I18nContext';

const PRIORITY_COLORS = {
  high: 'text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800',
  medium: 'text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
  low: 'text-muted-foreground bg-muted border-border',
};

export default function TaskBoard() {
  const { t } = useT();
  const COLUMNS = [
    {
      id: 'pending',
      label: t('common.pending'),
      color: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    },
    {
      id: 'in_progress',
      label: t('taskBoard.columnInProgress'),
      color: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
    },
    {
      id: 'done',
      label: t('taskBoard.columnDone'),
      color: 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800',
    },
  ];
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', client_id: '', priority: 'medium', due_date: '' });
  const queryClient = useQueryClient();

  const { data: tasks = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clientTasks'],
      queryFn: () => db.entities.ClientTask.list(),
    })
  );

  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clients'],
      queryFn: () => db.entities.Client.list(),
    })
  );

  const createTask = /** @type {any} */ (
    useMutation({
      mutationFn: (data) => db.entities.ClientTask.create(data),
      onSuccess: () => {
        showSuccess(t('taskBoard.createSuccess'));
        queryClient.invalidateQueries({ queryKey: ['clientTasks'] });
        setNewTaskOpen(false);
        setNewTask({ title: '', client_id: '', priority: 'medium', due_date: '' });
      },
      onError: (error) => showError(t('taskBoard.createError'), error.message),
    })
  );

  const updateTask = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) => db.entities.ClientTask.update(id, data),
      onSuccess: () => {
        showSuccess(t('taskBoard.updateSuccess'));
        queryClient.invalidateQueries({ queryKey: ['clientTasks'] });
      },
      onError: (error) => showError(t('taskBoard.updateError'), error.message),
    })
  );

  const deleteTask = /** @type {any} */ (
    useMutation({
      mutationFn: (id) => db.entities.ClientTask.delete(id),
      onSuccess: () => {
        showSuccess(t('taskBoard.deleteSuccess'));
        queryClient.invalidateQueries({ queryKey: ['clientTasks'] });
      },
      onError: (error) => showError(t('taskBoard.deleteError'), error.message),
    })
  );

  const columns = COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.status === col.id),
  }));

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const task = tasks.find((t) => t.id === draggableId);
    if (!task) return;
    if (task.status === destination.droppableId && result.source.index === destination.index) return;
    updateTask.mutate({ id: draggableId, data: { ...task, status: destination.droppableId } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2.5 rounded-xl">
            <ListCheck className="w-6 h-6 text-indigo-700 dark:text-indigo-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('taskBoard.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('taskBoard.subtitle')}</p>
          </div>
        </div>
        <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> {t('taskBoard.newTask')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('taskBoard.newTaskDialogTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input
                placeholder={t('taskBoard.taskTitlePlaceholder')}
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
              <Select value={newTask.client_id} onValueChange={(v) => setNewTask({ ...newTask, client_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('taskBoard.selectClientPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Input
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                placeholder={t('taskBoard.dueDatePlaceholder')}
              />
              <Button
                className="w-full"
                onClick={() => createTask.mutate({ ...newTask, status: 'pending' })}
                disabled={!newTask.title}
              >
                {t('taskBoard.createTask')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((col) => (
            <div key={col.id} className={`rounded-xl border ${col.color} p-3`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{col.label}</h3>
                <span className="text-xs text-muted-foreground bg-card px-2 py-0.5 rounded-full border">
                  {col.tasks.length}
                </span>
              </div>
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-2 min-h-[200px] ${snapshot.isDraggingOver ? 'bg-card/50 rounded-lg' : ''}`}
                  >
                    {col.tasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => {
                          const p = /** @type {any} */ (provided);
                          return (
                            <div
                              ref={p.innerRef}
                              {...p.draggableProps}
                              {...p.dragHandleProps}
                              className={`bg-card rounded-lg border border-border p-3 shadow-sm ${
                                snapshot.isDragging ? 'shadow-lg rotate-2' : ''
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium">{task.title}</p>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 -mt-0.5 -mr-1"
                                  onClick={() => deleteTask.mutate(task.id)}
                                >
                                  <MoreHorizontal className="w-3 h-3 text-muted-foreground" />
                                </Button>
                              </div>
                              {task.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Badge className={`text-[10px] ${PRIORITY_COLORS[task.priority] || 'bg-muted'}`}>
                                  {PRIORITY_COLORS[task.priority] ? t(`priority.${task.priority}`) : task.priority}
                                </Badge>
                                {task.due_date && (
                                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <CalendarIcon className="w-3 h-3" />
                                    {format(new Date(task.due_date), 'MMM d')}
                                  </span>
                                )}
                                {task.client_id && (
                                  <span className="text-[10px] text-muted-foreground truncate max-w-24">
                                    {clients.find((c) => c.id === task.client_id)?.name || ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        }}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
