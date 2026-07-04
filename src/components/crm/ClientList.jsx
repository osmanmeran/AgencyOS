import { db } from '@/lib/DbContext';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Star, Trash2, Phone, Mail, Building, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { filterClientsByCompany } from '@/lib/companySearch';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700 border-green-200',
  inactive: 'bg-gray-100 text-gray-600 border-gray-200',
  vip: 'bg-purple-100 text-purple-700 border-purple-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200'
};

export default function ClientList({ clients, colleagueIds, isLoading, selectedId, onSelect, onClientsDeleted }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const { filtered, colleagueSet } = useMemo(() => {
    // Company-aware search: matching a company (by name or any one of its
    // people) pulls in every colleague at that company.
    const { results, colleagueIds: localColleagueIds } = filterClientsByCompany(clients, search);
    const set = new Set([...(colleagueIds || []), ...localColleagueIds]);
    let result = results.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter && !(statusFilter === 'active' && c.status === 'vip')) return false;
      if (typeFilter !== 'all' && (c.type || 'client') !== typeFilter) return false;
      return true;
    });
    result.sort((a, b) => {
      let va, vb;
      if (sortKey === 'name') { va = a.name?.toLowerCase(); vb = b.name?.toLowerCase(); }
      else if (sortKey === 'company') { va = a.company?.toLowerCase(); vb = b.company?.toLowerCase(); }
      else if (sortKey === 'paid') { va = parseFloat(a.total_paid) || 0; vb = parseFloat(b.total_paid) || 0; }
      else if (sortKey === 'status') { va = a.status || ''; vb = b.status || ''; }
      else { va = a.name?.toLowerCase(); vb = b.name?.toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return { filtered: result, colleagueSet: set };
  }, [clients, colleagueIds, search, statusFilter, typeFilter, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const deletedIds = new Set(selectedIds);
    const results = await Promise.allSettled([...deletedIds].map(id => db.entities.Client.delete(id)));
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.error('Delete failed:', failed[0].reason);
      alert(`Failed to delete ${failed.length} contact(s). You may not have permission (admin/manager role required).`);
    }
    const succeeded = [...deletedIds].filter((_, i) => results[i].status === 'fulfilled');
    setSelectedIds(new Set());
    setConfirmOpen(false);
    setIsDeleting(false);
    if (succeeded.length > 0) onClientsDeleted?.(new Set(succeeded));
  };

  const SortIcon = ({ field }) => {
    if (sortKey !== field) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-blue-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 border-b border-slate-100 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search name, email, company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 text-sm h-8"
          />
          {search && colleagueSet.size > 0 && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-500 font-medium">
              +{colleagueSet.size} via company
            </span>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-xs w-[110px] border-slate-200">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 text-xs w-[110px] border-slate-200">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="supplier">Supplier</SelectItem>
            <SelectItem value="representative">Representative</SelectItem>
          </SelectContent>
        </Select>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-medium text-blue-700">{selectedIds.size} selected</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
            <Button size="sm" className="h-7 text-xs px-2 bg-red-600 hover:bg-red-700 text-white" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="w-3 h-3 mr-1" />Delete
            </Button>
          </div>
        )}
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} of {clients.length}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 font-semibold uppercase tracking-wide">
              <th className="px-3 py-2.5 w-8">
                <Checkbox
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onCheckedChange={() => {
                    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
                    else setSelectedIds(new Set(filtered.map(c => c.id)));
                  }}
                  className="h-3.5 w-3.5"
                />
              </th>
              <th className="px-3 py-2.5 text-left cursor-pointer select-none" onClick={() => toggleSort('name')}>
                Contact <SortIcon field="name" />
              </th>
              <th className="px-3 py-2.5 text-left cursor-pointer select-none" onClick={() => toggleSort('company')}>
                Company <SortIcon field="company" />
              </th>
              <th className="px-3 py-2.5 text-left">Contact Info</th>
              <th className="px-3 py-2.5 text-left">Location</th>
              <th className="px-3 py-2.5 text-left cursor-pointer select-none" onClick={() => toggleSort('status')}>
                Status <SortIcon field="status" />
              </th>
              <th className="px-3 py-2.5 text-right cursor-pointer select-none" onClick={() => toggleSort('paid')}>
                Revenue <SortIcon field="paid" />
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-3 py-3"><Skeleton className="h-4 w-4" /></td>
                  <td className="px-3 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-3 py-3"><Skeleton className="h-4 w-28" /></td>
                  <td className="px-3 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-3 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                  <td className="px-3 py-3 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-slate-400 py-12">No contacts found</td></tr>
            ) : filtered.map(client => (
              <tr
                key={client.id}
                onClick={() => onSelect(client.id)}
                className={`border-b border-slate-50 hover:bg-blue-50/40 transition-colors cursor-pointer ${
                  selectedId === client.id ? 'bg-blue-50' : ''
                } ${selectedIds.has(client.id) ? 'bg-blue-50/60' : ''}`}
              >
                <td className="px-3 py-3 w-8" onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(client.id)}
                    onCheckedChange={() => {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        next.has(client.id) ? next.delete(client.id) : next.add(client.id);
                        return next;
                      });
                    }}
                    className="h-3.5 w-3.5"
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                      client.status === 'vip' ? 'bg-gradient-to-br from-purple-500 to-purple-600' : 'bg-gradient-to-br from-blue-500 to-blue-600'
                    }`}>
                      {(client.name || '?').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-slate-800 flex items-center gap-1.5">
                        {client.name}
                        {client.status === 'vip' && <Star className="w-3 h-3 text-purple-500 fill-purple-500" />}
                        {client.potential_deal && !client.total_paid && (
                          <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Lead</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">{client.type || 'client'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  {client.company ? (
                    <div className="flex items-center gap-1.5">
                      <Building className={`w-3.5 h-3.5 flex-shrink-0 ${colleagueSet.has(client.id) ? 'text-blue-500' : 'text-slate-400'}`} />
                      <span className="text-slate-700 text-sm truncate max-w-[140px]">{client.company}</span>
                      {colleagueSet.has(client.id) && (
                        <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">same company</span>
                      )}
                    </div>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-3">
                  <div className="space-y-0.5">
                    {client.email ? (
                      <a href={`mailto:${client.email}`} onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600 truncate max-w-[160px]">
                        <Mail className="w-3 h-3 flex-shrink-0" />{client.email}
                      </a>
                    ) : null}
                    {client.phone ? (
                      <a href={`tel:${client.phone}`} onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600">
                        <Phone className="w-3 h-3 flex-shrink-0" />{client.phone}
                      </a>
                    ) : null}
                    {!client.email && !client.phone && <span className="text-slate-300 text-xs">—</span>}
                  </div>
                </td>
                <td className="px-3 py-3">
                  {client.city || client.country ? (
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate max-w-[120px]">{client.city}{client.city && client.country ? ', ' : ''}{client.country}</span>
                    </div>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-3">
                  <Badge className={`text-[10px] font-medium border ${STATUS_COLORS[client.status] || 'bg-slate-100 text-slate-600'}`}>
                    {client.status === 'vip' ? 'VIP' : client.status || 'active'}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-right">
                  {(client.total_paid || 0) > 0 ? (
                    <div>
                      <div className="text-sm font-semibold text-emerald-700">${(client.total_paid || 0).toFixed(0)}</div>
                      {(client.total_owed || 0) > 0 && (
                        <div className="text-[10px] text-red-500">{client.total_owed?.toFixed(0)} owed</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-300">—</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirm Delete */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} client{selectedIds.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>permanently delete</strong> the selected clients. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white">
              {isDeleting ? 'Deleting...' : `Delete ${selectedIds.size} client${selectedIds.size > 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
