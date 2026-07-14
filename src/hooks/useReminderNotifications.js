import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/DbContext';
import { showInfo } from '@/lib/toast';

const POLL_MS = 5 * 60 * 1000;

export function useReminderNotifications() {
  const shown = useRef(new Set());

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => db.auth.me(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['reminderNotifications'],
    queryFn: () => db.entities.ClientTask.list(),
    enabled: !!me,
    refetchInterval: POLL_MS,
  });

  useEffect(() => {
    if (!me || !tasks.length) return;
    const now = Date.now();
    tasks.forEach((task) => {
      if (task.type !== 'reminder') return;
      if (task.status === 'done') return;
      if (task.assigned_to && task.assigned_to !== me.email) return;
      if (task.created_by_id && task.created_by_id !== me.id) return;
      if (!task.due_date) return;
      const due = new Date(task.due_date).getTime();
      if (due <= now && !shown.current.has(task.id)) {
        shown.current.add(task.id);
        showInfo(task.title || 'Reminder', task.due_date);
      }
    });
  }, [tasks, me]);

  useEffect(() => {
    const ids = new Set(tasks.map((t) => t.id));
    [...shown.current].forEach((id) => {
      if (!ids.has(id)) shown.current.delete(id);
    });
  }, [tasks]);
}
