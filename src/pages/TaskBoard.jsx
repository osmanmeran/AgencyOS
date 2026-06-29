const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], list:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListCheck, Plus, MoreHorizontal, User, Calendar as CalendarIcon, AlertCircle, Clock } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { format } from 'date-fns';

const COLUMNS = [
  { id: 'pending', label: 'Pending', color: 'bg-amber-50 border-amber-200' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-50 border-blue-200' },
  { id: 'done', label: 'Done', color: 'bg-green-50 border-green-200' },
];

const PRIORITY_COLORS = {
  high: 'text-red-600 bg-red-50 border-red-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  low: 'text-slate-600 bg-slate-50 border-slate-200',
};

export default function TaskBoard() {
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', client_id: '', priority: 'medium', due_date: '' });
  const queryClient = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ['clientTasks'],
    queryFn: () => db.entities.ClientTask.list(),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => db.entities.Client.list(),
  });

  const createTask = useMutation({
    mutationFn: data => db.entities.ClientTask.create(data),
    onSuccess: () => { showSuccess('Task created'); queryClient.invalidateQueries({ queryKey: ['clientTasks'] }); setNewTaskOpen(false); setNewTask({ title: '', client_id: '', priority: 'medium', due_date: '' }); },
    onError: (error) => showError('Failed to create task', error.message)
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }) => db.entities.ClientTask.update(id, data),
    onSuccess: () => { showSuccess('Task updated'); queryClient.invalidateQueries({ queryKey: ['clientTasks'] }); },
    onError: (error) => showError('Failed to update task', error.message)
  });

  const deleteTask = useMutation({
    mutationFn: id => db.entities.ClientTask.delete(id),
    onSuccess: () => { showSuccess('Task deleted'); queryClient.invalidateQueries({ queryKey: ['clientTasks'] }); },
    onError: (error) => showError('Failed to delete task', error.message)
  });

  const columns = COLUMNS.map(col => ({
    ...col,
    tasks: tasks.filter(t => t.status === col.id),
  }));

  const onDragEnd = result => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const task = tasks.find(t => t.id === draggableId);
    if (!task) return;
    if (task.status === destination.droppableId && result.source.index === destination.index) return;
    updateTask.mutate({ id: draggableId, data: { ...task, status: destination.droppableId } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2.5 rounded-xl">
            <ListCheck className="w-6 h-6 text-indigo-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Task Board</h1>
            <p className="text-sm text-slate-500">Manage client tasks and reminders</p>
          </div>
        </div>
        <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" /> New Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder="Task title" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} />
              <Select value={newTask.client_id} onValueChange={v => setNewTask({ ...newTask, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select client (optional)" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={newTask.priority} onValueChange={v => setNewTask({ ...newTask, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={newTask.due_date} onChange={e => setNewTask({ ...newTask, due_date: e.target.value })} placeholder="Due date" />
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => createTask.mutate({ ...newTask, status: 'pending' })} disabled={!newTask.title}>
                Create Task
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map(col => (
            <div key={col.id} className={`rounded-xl border ${col.color} p-3`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{col.label}</h3>
                <span className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded-full border">{col.tasks.length}</span>
              </div>
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className={`space-y-2 min-h-[200px] ${snapshot.isDraggingOver ? 'bg-white/50 rounded-lg' : ''}`}>
                    {col.tasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-white rounded-lg border border-slate-200 p-3 shadow-sm ${
                              snapshot.isDragging ? 'shadow-lg rotate-2' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium">{task.title}</p>
                              <Button variant="ghost" size="icon" className="h-5 w-5 -mt-0.5 -mr-1" onClick={() => deleteTask.mutate(task.id)}>
                                <MoreHorizontal className="w-3 h-3 text-slate-300" />
                              </Button>
                            </div>
                            {task.description && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge className={`text-[10px] ${PRIORITY_COLORS[task.priority] || 'bg-slate-100'}`}>
                                {task.priority}
                              </Badge>
                              {task.due_date && (
                                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                  <CalendarIcon className="w-3 h-3" />
                                  {format(new Date(task.due_date), 'MMM d')}
                                </span>
                              )}
                              {task.client_id && (
                                <span className="text-[10px] text-slate-400 truncate max-w-24">
                                  {clients.find(c => c.id === task.client_id)?.name || ''}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
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
