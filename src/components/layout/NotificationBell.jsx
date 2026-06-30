import React, { useState } from 'react';
import { Bell, CheckCheck, X, Info, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
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

// const TOKEN_KEY = 'auth_token';

function getToken() {
  const stored = localStorage.getItem('b44_user');
  if (!stored) return null;
  try { return JSON.parse(stored).token; } catch { return null; }
}

const TYPE_ICONS = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: X,
};

const TYPE_COLORS = {
  info: 'text-blue-500 bg-blue-100',
  success: 'text-green-500 bg-green-100',
  warning: 'text-amber-500 bg-amber-100',
  error: 'text-red-500 bg-red-100',
};

async function api(path, opts = {}) {
  const token = getToken();
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = React.useState(false);
  const wsRef = React.useRef(null);

  React.useEffect(() => {
    loadNotifications();
    connectWebSocket();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  function connectWebSocket() {
    const token = getToken();
    if (!token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
    try {
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          setNotifications(prev => [data.notification, ...prev]);
          setUnread(prev => prev + 1);
        }
      };
      ws.onclose = () => { setTimeout(connectWebSocket, 3000); };
      wsRef.current = ws;
    } catch { /* will retry */ }
  }

  async function loadNotifications() {
    try {
      const { notifications: list, unread: count } = await api('/api/notifications?limit=20');
      setNotifications(list);
      setUnread(count);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  async function markAllRead() {
    try {
      await api('/api/notifications/read-all', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnread(0);
    } catch { /* ignore */ }
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
          <span>Notifications</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-6 gap-1" onClick={markAllRead}>
              <CheckCheck className="w-3 h-3" /> Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">No notifications</div>
          ) : (
            notifications.map(n => {
              const Icon = TYPE_ICONS[n.type] || Info;
              const colorClass = TYPE_COLORS[n.type] || TYPE_COLORS.info;
              return (
                <DropdownMenuItem key={n.id} className={`flex items-start gap-3 px-4 py-3 cursor-pointer ${!n.read ? 'bg-blue-50/50' : ''}`}>
                  <div className={`p-1.5 rounded-full ${colorClass} mt-0.5`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{n.title}</p>
                    {n.message && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>}
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(n.created_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
