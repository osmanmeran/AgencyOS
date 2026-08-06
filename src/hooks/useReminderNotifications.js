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

  // Only open reminders can produce a toast, so don't pull the closed ones
  // over the wire every five minutes — the workspace accumulates those forever.
  const { data: tasks = [] } = useQuery({
    queryKey: ['reminderNotifications'],
    queryFn: () => db.tasks.list({ type: 'reminder', status: 'pending,in_progress' }),
    enabled: !!me,
    refetchInterval: POLL_MS,
  });

  useEffect(() => {
    if (!me || !tasks.length) return;
    const now = Date.now();
    tasks.forEach((task) => {
      // Task isn't user-scoped like the old ClientTask was — everyone with
      // view_all_trips sees every reminder — so "is this mine" has to be
      // enforced here: assigned reminders are mine only if assigned to me;
      // unassigned ones are mine only if I created them.
      const isMine = task.assigned_to_user_id ? task.assigned_to_user_id === me.id : task.created_by === me.id;
      if (!isMine) return;
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
