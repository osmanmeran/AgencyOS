import { db } from '@/lib/DbContext';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Star, Phone, Mail, Building, MapPin, Download, Loader2, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { filterClientsByCompany } from '@/lib/companySearch';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { useSelection } from '@/hooks/useSelection';
import { useExport } from '@/hooks/useExport';
import BulkActionsBar from '@/components/shared/BulkActionsBar';
import PaginationControls from '@/components/shared/PaginationControls';
import { showSuccess, showError } from '@/lib/toast';
import { useT } from '@/lib/i18n/I18nContext';

const STATUS_COLORS = {
  active: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  inactive: 'bg-muted text-muted-foreground border-border',
  vip: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  cancelled: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
};

const STATUS_OPTIONS = ['active', 'inactive', 'vip'];
const PAGE_SIZE = 24;

export default function ClientList({ clients, colleagueIds, isLoading, selectedId, onSelect, onClientsDeleted }) {
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);
  const { exportCSV } = useExport();

  const { filtered, colleagueSet } = useMemo(() => {
    // Company-aware search: matching a company (by name or any one of its
    // people) pulls in every colleague at that company.
    const { results, colleagueIds: localColleagueIds } = filterClientsByCompany(clients, search);
    const set = new Set([...(colleagueIds || []), ...localColleagueIds]);
    let result = results.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter && !(statusFilter === 'active' && c.status === 'vip'))
        return false;
      if (typeFilter !== 'all' && (c.type || 'client') !== typeFilter) return false;
      return true;
    });
    result.sort((a, b) => {
      let va, vb;
      if (sortKey === 'name') {
        va = a.name?.toLowerCase();
        vb = b.name?.toLowerCase();
      } else if (sortKey === 'company') {
        va = a.company?.toLowerCase();
        vb = b.company?.toLowerCase();
      } else if (sortKey === 'paid') {
        va = parseFloat(a.total_paid) || 0;
        vb = parseFloat(b.total_paid) || 0;
      } else if (sortKey === 'status') {
        va = a.status || '';
        vb = b.status || '';
      } else {
        va = a.name?.toLowerCase();
        vb = b.name?.toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return { filtered: result, colleagueSet: set };
  }, [clients, colleagueIds, search, statusFilter, typeFilter, sortKey, sortDir]);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, typeFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const { selectedIds, toggle, toggleAll, clear, allSelected, count: selectedCount } = useSelection(pageItems);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const deletedIds = new Set(selectedIds);
    const results = await Promise.allSettled([...deletedIds].map((id) => db.entities.Client.delete(id)));
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      showError(t('clientList.deleteFailedTitle', { count: failed.length }), t('clientList.deleteFailedBody'));
    }
    const succeeded = [...deletedIds].filter((_, i) => results[i].status === 'fulfilled');
    clear();
    setConfirmOpen(false);
    setIsDeleting(false);
    if (succeeded.length > 0) onClientsDeleted?.(new Set(succeeded));
  };

  const handleBulkStatusChange = async (status) => {
    setIsBulkUpdating(true);
    try {
      const ids = [...selectedIds];
      await db.entities.Client.bulkUpdate(ids, { status });
      showSuccess(
        ids.length === 1
          ? t('clientList.bulkUpdateSuccessSingular', { count: ids.length, status })
          : t('clientList.bulkUpdateSuccessPlural', { count: ids.length, status }),
      );
      clear();
    } catch (error) {
      showError(t('clientList.bulkUpdateError'), error.message);
    }
    setIsBulkUpdating(false);
  };

  const handleExport = () => {
    setIsExporting(true);
    try {
      exportCSV(filtered, 'clients', [
        { label: t('common.name'), accessor: (c) => c.name },
        { label: t('common.email'), accessor: (c) => c.email },
        { label: t('common.phone'), accessor: (c) => c.phone },
        { label: t('clientList.companyColumn'), accessor: (c) => c.company },
        { label: t('common.city'), accessor: (c) => c.city },
        { label: t('common.status'), accessor: (c) => c.status },
        { label: t('clientList.totalPaidColumn'), accessor: (c) => c.total_paid },
        { label: t('clientList.totalOwedColumn'), accessor: (c) => c.total_owed },
      ]);
    } finally {
      setIsExporting(false);
    }
  };

  const SortIcon = ({ field }) => {
    if (sortKey !== field) return <span className="text-muted-foreground ml-1">↕</span>;
    return <span className="text-blue-600 dark:text-blue-300 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="space-y-3">
      <BulkActionsBar count={selectedCount} labelSingular="client" labelPlural="clients" onDeselectAll={clear}>
        <Select onValueChange={handleBulkStatusChange} disabled={isBulkUpdating}>
          <SelectTrigger className="w-44 h-9 bg-card">
            <SelectValue placeholder={t('reservations.changeStatusPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setConfirmOpen(true)}>
          <XCircle className="w-4 h-4 mr-2" />
          {t('reservations.deleteCount', { count: selectedCount })}
        </Button>
      </BulkActionsBar>

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-3 border-b border-border flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={t('clientList.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm h-8"
            />
            {search && colleagueSet.size > 0 && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-500 dark:text-blue-300 font-medium">
                {t('clientList.viaCompanyBadge', { count: colleagueSet.size })}
              </span>
            )}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-[110px] border-border">
              <SelectValue placeholder={t('clientList.statusFilterPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('clientList.allStatus')}</SelectItem>
              <SelectItem value="active">{t('common.active')}</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
              <SelectItem value="inactive">{t('common.inactive')}</SelectItem>
              <SelectItem value="cancelled">{t('common.cancelled')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 text-xs w-[110px] border-border">
              <SelectValue placeholder={t('clientList.typeFilterPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('clientList.allTypes')}</SelectItem>
              <SelectItem value="client">{t('clientList.typeClient')}</SelectItem>
              <SelectItem value="supplier">{t('clientList.typeSupplier')}</SelectItem>
              <SelectItem value="representative">{t('clientList.typeRepresentative')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={handleExport}
            disabled={isExporting || filtered.length === 0}
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 mr-1.5" />
            )}
            {t('common.exportCsv')}
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {t('clientList.filteredOfTotal', { filtered: filtered.length, total: clients.length })}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                <th className="px-3 py-2.5 w-8">
                  <Checkbox
                    checked={pageItems.length > 0 && allSelected}
                    onCheckedChange={toggleAll}
                    className="h-3.5 w-3.5"
                  />
                </th>
                <th className="px-3 py-2.5 text-left cursor-pointer select-none" onClick={() => toggleSort('name')}>
                  {t('clientList.contactColumn')} <SortIcon field="name" />
                </th>
                <th className="px-3 py-2.5 text-left cursor-pointer select-none" onClick={() => toggleSort('company')}>
                  {t('clientList.companyColumn')} <SortIcon field="company" />
                </th>
                <th className="px-3 py-2.5 text-left">{t('clientList.contactInfoColumn')}</th>
                <th className="px-3 py-2.5 text-left">{t('clientList.locationColumn')}</th>
                <th className="px-3 py-2.5 text-left cursor-pointer select-none" onClick={() => toggleSort('status')}>
                  {t('common.status')} <SortIcon field="status" />
                </th>
                <th className="px-3 py-2.5 text-right cursor-pointer select-none" onClick={() => toggleSort('paid')}>
                  {t('clientList.revenueColumn')} <SortIcon field="paid" />
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-3 py-3">
                      <Skeleton className="h-4 w-4" />
                    </td>
                    <td className="px-3 py-3">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-3 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-3 py-3">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="px-3 py-3">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-3 py-3">
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Skeleton className="h-4 w-12 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-12">
                    {t('clientList.noContactsFound')}
                  </td>
                </tr>
              ) : (
                pageItems.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => onSelect(client.id)}
                    className={`border-b border-border hover:bg-blue-50/40 dark:hover:bg-blue-950/40 transition-colors cursor-pointer ${
                      selectedId === client.id ? 'bg-blue-50 dark:bg-blue-950/40' : ''
                    } ${selectedIds.has(client.id) ? 'bg-blue-50/60 dark:bg-blue-950/60' : ''}`}
                  >
                    <td className="px-3 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(client.id)}
                        onCheckedChange={() => toggle(client.id)}
                        className="h-3.5 w-3.5"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                            client.status === 'vip'
                              ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                              : 'bg-gradient-to-br from-blue-500 to-blue-600'
                          }`}
                        >
                          {(client.name || '?')
                            .split(' ')
                            .map((s) => s[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-foreground flex items-center gap-1.5">
                            {client.name}
                            {client.status === 'vip' && (
                              <Star className="w-3 h-3 text-purple-500 dark:text-purple-300 fill-purple-500" />
                            )}
                            {client.potential_deal && !client.total_paid && (
                              <span className="text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-medium">
                                {t('clientList.leadBadge')}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {
                              {
                                client: t('clientList.typeClient'),
                                supplier: t('clientList.typeSupplier'),
                                representative: t('clientList.typeRepresentative'),
                              }[client.type || 'client']
                            }
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {client.company ? (
                        <div className="flex items-center gap-1.5">
                          <Building
                            className={`w-3.5 h-3.5 flex-shrink-0 ${colleagueSet.has(client.id) ? 'text-blue-500 dark:text-blue-300' : 'text-muted-foreground'}`}
                          />
                          {client.company_id ? (
                            <Link
                              to={createPageUrl(`CompanyDetails?id=${client.company_id}`)}
                              onClick={(e) => e.stopPropagation()}
                              className="text-foreground text-sm truncate max-w-[140px] hover:text-indigo-600 dark:hover:text-indigo-300 hover:underline"
                            >
                              {client.company}
                            </Link>
                          ) : (
                            <span className="text-foreground text-sm truncate max-w-[140px]">{client.company}</span>
                          )}
                          {colleagueSet.has(client.id) && (
                            <span className="text-[9px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                              {t('clientList.sameCompanyBadge')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-0.5">
                        {client.email ? (
                          <a
                            href={`mailto:${client.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-blue-600 dark:hover:text-blue-300 truncate max-w-[160px]"
                          >
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            {client.email}
                          </a>
                        ) : null}
                        {client.phone ? (
                          <a
                            href={`tel:${client.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-blue-600 dark:hover:text-blue-300"
                          >
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            {client.phone}
                          </a>
                        ) : null}
                        {!client.email && !client.phone && <span className="text-muted-foreground text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {client.city || client.country ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-[120px]">
                            {client.city}
                            {client.city && client.country ? ', ' : ''}
                            {client.country}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        className={`text-[10px] font-medium border ${STATUS_COLORS[client.status] || 'bg-muted text-muted-foreground'}`}
                      >
                        {client.status === 'vip'
                          ? 'VIP'
                          : client.status
                            ? t(`common.${client.status}`)
                            : t('common.active')}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {(client.total_paid || 0) > 0 ? (
                        <div>
                          <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                            ${(client.total_paid || 0).toFixed(0)}
                          </div>
                          {(client.total_owed || 0) > 0 && (
                            <div className="text-[10px] text-red-500 dark:text-red-300">
                              {t('clientList.owedSuffix', { amount: client.total_owed?.toFixed(0) })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">—</div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && filtered.length > 0 && (
          <div className="px-3 py-3 border-t border-border">
            <PaginationControls
              page={page}
              pageCount={pageCount}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Confirm Delete */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedCount > 1
                ? t('clientList.deleteTitlePlural', { count: selectedCount })
                : t('clientList.deleteTitleSingular', { count: selectedCount })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('clientList.deleteWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting
                ? t('reservations.deleting')
                : selectedCount > 1
                  ? t('clientList.yesDeletePlural', { count: selectedCount })
                  : t('clientList.yesDeleteSingular', { count: selectedCount })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
