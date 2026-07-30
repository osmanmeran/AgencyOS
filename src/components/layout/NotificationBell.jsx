import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, X, Info, AlertTriangle, CheckCircle, Loader2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { acquireRealtime, releaseRealtime, onRealtimeMessage } from '@/lib/realtime';
import { useT } from '@/lib/i18n/I18nContext';
import { getCsrfToken } from '@/lib/csrf';

const TYPE_ICONS = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: X,
  quote_request: ClipboardList,
};

const TYPE_COLORS = {
  info: 'text-blue-500 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40',
  success: 'text-green-500 dark:text-green-300 bg-green-100 dark:bg-green-900/40',
  warning: 'text-amber-500 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40',
  error: 'text-red-500 dark:text-red-300 bg-red-100 dark:bg-red-900/40',
  quote_request: 'text-blue-600 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40',
};

async function api(path, opts = {}) {
  const csrfToken = getCsrfToken();
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...opts.headers,
    },
    credentials: 'include',
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function NotificationBell() {
  const { t, language } = useT();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    loadNotifications();
    acquireRealtime();
    const unsubscribe = onRealtimeMessage((data) => {
      if (data.type === 'notification') {
        setNotifications((prev) => [data.notification, ...prev]);
        setUnread((prev) => prev + 1);
      }
    });
    return () => {
      unsubscribe();
      releaseRealtime();
    };
  }, []);

  async function loadNotifications() {
    try {
      const { notifications: list, unread: count } = await api('/api/notifications?limit=20');
      setNotifications(list);
      setUnread(count);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    try {
      await api('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch {
      /* ignore */
    }
  }

  async function handleClick(n) {
    setOpen(false);
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((prev) => Math.max(0, prev - 1));
      try {
        await api(`/api/notifications/${n.id}/read`, { method: 'PATCH' });
      } catch {
        /* ignore */
      }
    }
    if (n.data?.url) navigate(n.data.url);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t('notificationBell.notifications')}</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-6 gap-1" onClick={markAllRead}>
              <CheckCheck className="w-3 h-3" /> {t('notificationBell.markAllRead')}
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {t('notificationBell.noNotifications')}
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = TYPE_ICONS[n.type] || Info;
              const colorClass = TYPE_COLORS[n.type] || TYPE_COLORS.info;
              return (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer ${!n.read ? 'bg-blue-50/50 dark:bg-blue-950/50' : ''}`}
                >
                  <div className={`p-1.5 rounded-full ${colorClass} mt-0.5`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                    {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.created_date).toLocaleDateString(language, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />}
                </DropdownMenuItem>
              );
            })
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
