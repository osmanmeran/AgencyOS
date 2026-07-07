import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  History,
  Search,
  RefreshCw,
  Loader2,
  FileText,
  User,
  LogIn,
  Upload,
  FileDown,
  Trash2,
  Edit3,
  Mail,
} from 'lucide-react';

const ACTION_ICONS = {
  create: { icon: FileText, color: 'text-green-600 dark:text-green-300 bg-green-100 dark:bg-green-900/40' },
  update: { icon: Edit3, color: 'text-blue-600 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40' },
  delete: { icon: Trash2, color: 'text-red-600 dark:text-red-300 bg-red-100 dark:bg-red-900/40' },
  login: { icon: LogIn, color: 'text-purple-600 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40' },
  email_sent: { icon: Mail, color: 'text-cyan-600 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-900/40' },
  pdf_generated: { icon: FileDown, color: 'text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40' },
  upload: { icon: Upload, color: 'text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/40' },
};

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    credentials: 'include',
    ...opts,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error?.message || 'Request failed');
  return res.json();
}

const ENTITY_TYPE_OPTIONS = [
  '',
  'auth',
  'entities',
  'notifications',
  'documents',
  'proposal',
  'booking',
  'invoice',
  'email',
];

export default function AuditLogViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [searching, setSearching] = useState(false);

  const loadLogs = async (filters = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.entityType || filterEntity) params.set('entity_type', filters.entityType || filterEntity);
      if (filters.action || filterAction) params.set('action', filters.action || filterAction);
      if (filters.userId || filterUser) params.set('user_id', filters.userId || filterUser);
      params.set('limit', '100');
      const { logs: data } = await api(`/api/audit/logs?${params}`);
      setLogs(data);
    } catch (_) {
      /* ignore */
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearching(true);
    loadLogs();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/20">
            <History className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Audit Trail</h1>
            <p className="text-sm text-muted-foreground">Track all state-changing actions across the system</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadLogs();
          }}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Card className="p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Entity Type</label>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t || 'All types'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Action</label>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                {['', 'create', 'update', 'delete', 'login', 'email_sent', 'pdf_generated', 'upload'].map((a) => (
                  <SelectItem key={a} value={a}>
                    {a || 'All actions'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">User ID</label>
            <Input
              placeholder="Filter by user..."
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-40 h-10"
            />
          </div>
          <Button type="submit" disabled={searching} className="h-10">
            {searching ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
            Search
          </Button>
        </form>
      </Card>

      <Card>
        <ScrollArea className="h-[600px]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">No audit logs found</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map((log) => {
                const ac = ACTION_ICONS[log.action] || { icon: History, color: 'text-muted-foreground bg-muted' };
                const Icon = ac.icon;
                return (
                  <div key={log.id} className="p-4 hover:bg-muted transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${ac.color} mt-0.5`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs capitalize">
                            {log.action}
                          </Badge>
                          {log.entity_type && (
                            <Badge variant="secondary" className="text-xs">
                              {log.entity_type}
                            </Badge>
                          )}
                          {log.entity_id && (
                            <span className="text-xs font-mono text-muted-foreground">#{log.entity_id}</span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {log.user_name && (
                            <span className="inline-flex items-center gap-1 mr-3">
                              <User className="w-3 h-3" /> {log.user_name}
                            </span>
                          )}
                          {log.ip && <span className="text-xs text-muted-foreground">IP: {log.ip}</span>}
                        </div>
                        {log.changes && Object.keys(log.changes).length > 0 && (
                          <div className="mt-2 text-xs font-mono bg-muted rounded p-2 border border-border overflow-x-auto">
                            {Object.entries(log.changes).map(([k, v]) => (
                              <div key={k} className="flex flex-wrap gap-2">
                                <span className="text-muted-foreground font-semibold min-w-[100px]">{k}:</span>
                                <span className="text-foreground">{typeof v === 'string' ? v : JSON.stringify(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(log.created_date).toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </Card>
    </div>
  );
}
