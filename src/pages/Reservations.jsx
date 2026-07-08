import { db } from '@/lib/DbContext';

import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useExport } from '@/hooks/useExport';
import { usePaginatedEntities } from '@/hooks/usePaginatedEntities';
import { useSelection } from '@/hooks/useSelection';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  CalendarCheck,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Search,
  MapPin,
  Calendar,
  Users,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  Plane,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import {
  format,
  parseISO,
  isBefore,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import CurrencyConverter from '../components/currency/CurrencyConverter';
import PastReservationsSearch from '../components/reservations/PastReservationsSearch';
import BulkActionsBar from '@/components/shared/BulkActionsBar';
import { useT } from '@/lib/i18n/I18nContext';
import { showSuccess, showError } from '@/lib/toast';

const currSymbol = (cur) =>
  ({
    USD: '$',
    EUR: '€',
    GBP: '£',
    TRY: '₺',
    AED: 'د.إ',
    SAR: '﷼',
    EGP: 'E£',
    MAD: 'MAD',
    JPY: '¥',
    CHF: 'CHF',
    CAD: 'CA$',
    AUD: 'A$',
  })[cur] || cur;

const PROPOSAL_STATUS_CONFIG = {
  pending: { color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300', icon: Clock },
  sent: { color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300', icon: Send },
  confirmed: { color: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300', icon: CheckCircle },
  rejected: { color: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300', icon: XCircle },
};

function ReservationCard({ trip, selected, onToggleSelect }) {
  const { t } = useT();
  const sc = currSymbol(trip.selling_currency || 'USD');
  const statusConf = PROPOSAL_STATUS_CONFIG[trip.proposal_status] || PROPOSAL_STATUS_CONFIG.pending;
  const StatusIcon = statusConf.icon;
  const paxCount = trip.passengers?.length || 0;

  return (
    <div className="relative">
      {onToggleSelect && (
        <div
          className="absolute top-4 left-4 z-10"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSelect(trip.id);
          }}
        >
          <Checkbox checked={selected} />
        </div>
      )}
      <Link to={createPageUrl(`ReservationDetails?id=${trip.id}`)}>
        <Card
          className={`p-5 bg-card hover:shadow-xl transition-all cursor-pointer group border-l-4 border-l-transparent hover:border-l-blue-500 ${selected ? 'ring-2 ring-blue-500' : ''}`}
        >
          <div className="flex justify-between items-start mb-3">
            <div className={`flex-1 min-w-0 ${onToggleSelect ? 'pl-7' : ''}`}>
              <h3 className="font-bold text-foreground text-lg truncate group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
                {trip.name}
              </h3>
              {trip.reference_number && (
                <span className="text-xs font-mono text-muted-foreground">{trip.reference_number}</span>
              )}
            </div>
            <Badge className={`${statusConf.color} flex items-center gap-1 ml-2 flex-shrink-0`}>
              <StatusIcon className="w-3 h-3" />
              {t(`common.${trip.proposal_status || 'pending'}`)}
            </Badge>
          </div>

          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{trip.destination}</span>
            </div>
            {trip.start_date && trip.end_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  {format(new Date(trip.start_date), 'MMM d')} – {format(new Date(trip.end_date), 'MMM d, yyyy')}
                </span>
              </div>
            )}
            {trip.client_name && (
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  {trip.client_name}
                  {paxCount > 0 ? ` · ${t('dashboard.paxCount', { count: paxCount })}` : ''}
                </span>
              </div>
            )}
          </div>

          {trip.total_cost > 0 && (
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t('clientProposalDetails.total')}</span>
              <span className="font-bold text-green-700 dark:text-green-300">
                {sc}
                {trip.total_cost.toFixed(2)}
              </span>
            </div>
          )}
        </Card>
      </Link>
    </div>
  );
}

const CAL_STATUS_COLORS = {
  planning:
    'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  confirmed: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
  in_progress:
    'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-300 dark:border-green-800',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800',
};

export default function Reservations() {
  const { t } = useT();
  const [calMonth, setCalMonth] = useState(new Date());
  const [calSelectedDate, setCalSelectedDate] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const today = new Date();
  const queryClient = useQueryClient();
  const { exportCSV } = useExport();

  // Tab counts and the calendar view both need to see every trip at once —
  // pagination controls aren't shown here (unlike Clients/Suppliers) since
  // slicing into pages would fragment tab counts and break the calendar,
  // which needs the full set to place events on the right day regardless of
  // what "page" they'd fall on. Search still runs server-side; a generous
  // page size keeps today's real trip volume on one fetch.
  const {
    items: trips,
    total,
    search,
    setSearch,
    isLoading,
    isFetching,
  } = usePaginatedEntities('Trip', { pageSize: 200, sort: 'start_date' });

  const currentTrips = trips.filter((t) => {
    if (!t.end_date) return true;
    return !isBefore(parseISO(t.end_date), today);
  });

  const filtered = currentTrips;

  const byStatus = (status) => filtered.filter((t) => (t.proposal_status || 'pending') === status);

  const isCancelled = (t) => t.proposal_status === 'rejected' || t.status === 'cancelled';

  const cancelledTrips = trips.filter((t) => isCancelled(t));
  const cancelledCount = cancelledTrips.length;

  const { selectedIds, toggle, toggleAll, clear, allSelected, count: selectedCount } = useSelection(filtered);

  const deleteCancelledMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () => db.entities.Trip.bulkDelete(cancelledTrips.map((t) => t.id)),
      onSuccess: () => {
        showSuccess(t('reservations.cancelledDeleteSuccess'));
        queryClient.invalidateQueries({ queryKey: ['Trip'] });
      },
      onError: (error) => showError(t('reservations.cancelledDeleteError'), error.message),
    })
  );

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const result = await db.entities.Trip.bulkDelete([...selectedIds]);
      if (result.skipped.length > 0) {
        showError(
          t(result.skipped.length === 1 ? 'reservations.skippedErrorSingular' : 'reservations.skippedErrorPlural', {
            count: result.skipped.length,
          }),
          t('reservations.skippedErrorBody'),
        );
      } else {
        showSuccess(t('reservations.reservationsDeletedSuccess'));
      }
      clear();
      setBulkDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ['Trip'] });
    } catch (error) {
      showError(t('reservations.bulkDeleteError'), error.message);
    }
    setIsBulkDeleting(false);
  };

  const handleBulkStatusChange = async (proposal_status) => {
    setIsBulkUpdating(true);
    try {
      const ids = [...selectedIds];
      await db.entities.Trip.bulkUpdate(ids, { proposal_status });
      showSuccess(
        t(ids.length === 1 ? 'reservations.statusUpdateSuccessSingular' : 'reservations.statusUpdateSuccessPlural', {
          count: ids.length,
          status: t(`common.${proposal_status}`),
        }),
      );
      clear();
      queryClient.invalidateQueries({ queryKey: ['Trip'] });
    } catch (error) {
      showError(t('reservations.statusUpdateError'), error.message);
    }
    setIsBulkUpdating(false);
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const all = search
        ? (await db.entities.Trip.page({ search, sort: 'start_date', limit: 500 })).data
        : await db.entities.Trip.list('start_date');
      exportCSV(all, 'reservations', [
        { label: 'Name', accessor: (t) => t.name },
        { label: 'Client Name', accessor: (t) => t.client_name },
        { label: 'Destination', accessor: (t) => t.destination },
        { label: 'Start Date', accessor: (t) => t.start_date },
        { label: 'End Date', accessor: (t) => t.end_date },
        { label: 'Status', accessor: (t) => t.proposal_status || 'pending' },
        { label: 'Total Cost', accessor: (t) => t.total_cost },
      ]);
    } catch (error) {
      showError(t('reservations.exportError'), error.message);
    }
    setIsExporting(false);
  };

  // Calendar logic
  const calMonthStart = startOfMonth(calMonth);
  const calMonthEnd = endOfMonth(calMonthStart);
  const calStart = startOfWeek(calMonthStart);
  const calEnd = endOfWeek(calMonthEnd);
  const calDays = [];
  let calDay = calStart;
  while (calDay <= calEnd) {
    calDays.push(calDay);
    calDay = addDays(calDay, 1);
  }

  const calEventsByDate = useMemo(() => {
    const map = {};
    trips.forEach((trip) => {
      if (!trip.start_date) return;
      const d = trip.start_date.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(trip);
    });
    return map;
  }, [trips]);

  const calSelectedEvents = calSelectedDate ? calEventsByDate[format(calSelectedDate, 'yyyy-MM-dd')] || [] : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <CalendarCheck className="w-12 h-12 text-blue-600 dark:text-blue-300 animate-bounce mx-auto mb-4" />
          <p className="text-muted-foreground">{t('reservations.loadingReservations')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-1">{t('reservations.title')}</h1>
          <p className="text-muted-foreground">{t('reservations.subtitle')}</p>
        </div>
        <Link to={createPageUrl('CreateReservation')}>
          <Button
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-600/30"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t('reservations.newReservation')}
          </Button>
        </Link>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(PROPOSAL_STATUS_CONFIG).map(([key, conf]) => {
          const count =
            key === 'rejected'
              ? cancelledCount
              : currentTrips.filter((t) => (t.proposal_status || 'pending') === key).length;
          const Icon = conf.icon;
          if (key === 'rejected') {
            return (
              <div
                key={key}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300"
              >
                <XCircle className="w-3.5 h-3.5" />
                {t('reservations.cancelledLabel', { count: cancelledCount })}
              </div>
            );
          }
          return (
            <div
              key={key}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${conf.color}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t(`common.${key}`)}: {count}
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <TabsList className="bg-card border border-border p-1">
            <TabsTrigger value="all" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              {t('common.all')} ({filtered.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
              {t('common.pending')} ({byStatus('pending').length})
            </TabsTrigger>
            <TabsTrigger value="sent" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              {t('common.sent')} ({byStatus('sent').length})
            </TabsTrigger>
            <TabsTrigger value="confirmed" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
              {t('common.confirmed')} ({byStatus('confirmed').length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              {t('common.cancelled')} ({cancelledCount})
            </TabsTrigger>
            <TabsTrigger value="past" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">
              {t('reservations.past')}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              <Calendar className="w-3.5 h-3.5 mr-1" />
              {t('reservations.calendarTab')}
            </TabsTrigger>
          </TabsList>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('reservations.searchPlaceholder')}
              className="pl-9 pr-9"
            />
            {isFetching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
            )}
          </div>
          <Button variant="outline" size="sm" onClick={toggleAll}>
            {allSelected ? t('common.deselectAll') : t('common.selectAll')}
          </Button>
          <Button variant="outline" onClick={handleExportAll} disabled={isExporting}>
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {t('common.exportCsv')}
          </Button>
        </div>

        <BulkActionsBar
          count={selectedCount}
          labelSingular={t('reservations.reservationNoun')}
          labelPlural={t('reservations.reservationNounPlural')}
          onDeselectAll={clear}
        >
          <Select onValueChange={handleBulkStatusChange} disabled={isBulkUpdating}>
            <SelectTrigger className="w-44 h-9 bg-card">
              <SelectValue placeholder={t('reservations.changeStatusPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(PROPOSAL_STATUS_CONFIG).map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`common.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setBulkDeleteOpen(true)}>
            <XCircle className="w-4 h-4 mr-2" />
            {t('reservations.deleteCount', { count: selectedCount })}
          </Button>
        </BulkActionsBar>

        {['all', 'pending', 'sent', 'confirmed', 'rejected'].map((tab) => {
          const list =
            tab === 'all' ? filtered : tab === 'rejected' ? trips.filter((t) => isCancelled(t)) : byStatus(tab);
          return (
            <TabsContent key={tab} value={tab}>
              {list.length === 0 ? (
                <div className="text-center py-16">
                  <div className="bg-card rounded-2xl p-10 max-w-sm mx-auto shadow-sm">
                    <CalendarCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {t('reservations.noReservations', { status: tab === 'all' ? '' : tab })}
                    </p>
                    {tab === 'all' && (
                      <Link to={createPageUrl('CreateReservation')}>
                        <Button className="mt-4 bg-blue-600 hover:bg-blue-700">
                          <Plus className="w-4 h-4 mr-2" />
                          {t('reservations.createFirst')}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  {(() => {
                    const grouped = {};
                    const groupOrder = [];
                    for (const trip of list) {
                      if (!trip.start_date) {
                        if (!grouped['__unscheduled']) grouped['__unscheduled'] = [];
                        grouped['__unscheduled'].push(trip);
                        continue;
                      }
                      const key = format(new Date(trip.start_date), 'yyyy-MM-dd');
                      if (!grouped[key]) {
                        grouped[key] = [];
                        groupOrder.push(key);
                      }
                      grouped[key].push(trip);
                    }
                    return (
                      <>
                        {groupOrder.map((key) => {
                          const date = new Date(key + 'T00:00:00');
                          return (
                            <div key={key} className="mb-8">
                              <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-blue-200 dark:border-blue-800">
                                <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold">
                                  {format(date, 'd')}
                                </div>
                                <div>
                                  <div className="font-bold text-foreground">{format(date, 'EEEE, MMM d, yyyy')}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {t(
                                      grouped[key].length === 1
                                        ? 'reservations.reservationSingular'
                                        : 'reservations.reservationPlural',
                                      { count: grouped[key].length },
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {grouped[key].map((trip) => (
                                  <ReservationCard
                                    key={trip.id}
                                    trip={trip}
                                    selected={selectedIds.has(trip.id)}
                                    onToggleSelect={toggle}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        {grouped['__unscheduled'] && (
                          <div className="mb-8">
                            <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-border">
                              <div className="bg-muted-foreground text-background rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold">
                                ∞
                              </div>
                              <div className="font-bold text-muted-foreground">{t('reservations.unscheduled')}</div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                              {grouped['__unscheduled'].map((trip) => (
                                <ReservationCard
                                  key={trip.id}
                                  trip={trip}
                                  selected={selectedIds.has(trip.id)}
                                  onToggleSelect={toggle}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {tab === 'rejected' && cancelledCount > 0 && (
                    <div className="mt-6 flex justify-center">
                      <Button
                        variant="destructive"
                        onClick={() => {
                          if (confirm(t('reservations.eraseConfirm', { count: cancelledCount }))) {
                            deleteCancelledMutation.mutate();
                          }
                        }}
                        disabled={deleteCancelledMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {deleteCancelledMutation.isPending
                          ? t('reservations.erasing')
                          : t('reservations.eraseAllCancelled', { count: cancelledCount })}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          );
        })}

        <TabsContent value="past">
          <PastReservationsSearch />
        </TabsContent>

        <TabsContent value="calendar">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-card p-4">
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={() => setCalMonth(subMonths(calMonth, 1))}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-lg font-semibold">{format(calMonth, 'MMMM yyyy')}</h2>
                <Button variant="ghost" size="icon" onClick={() => setCalMonth(addMonths(calMonth, 1))}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
                {t('dashboard.weekdays').map((d) => (
                  <div key={d} className="bg-muted px-2 py-1.5 text-center text-xs font-semibold text-muted-foreground">
                    {d}
                  </div>
                ))}
                {calDays.map((d) => {
                  const dateStr = format(d, 'yyyy-MM-dd');
                  const events = calEventsByDate[dateStr] || [];
                  const isCurrent = isSameDay(d, new Date());
                  const isSelected = calSelectedDate && isSameDay(d, calSelectedDate);
                  const inMonth = isSameMonth(d, calMonth);
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setCalSelectedDate(calSelectedDate && isSameDay(d, calSelectedDate) ? null : d)}
                      className={`bg-card min-h-[80px] p-1.5 text-left transition-colors ${!inMonth ? 'opacity-40' : ''} ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''} hover:bg-blue-50 dark:hover:bg-blue-950/40`}
                    >
                      <span
                        className={`text-xs font-medium mb-1 block ${isCurrent ? 'bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center' : 'text-muted-foreground'}`}
                      >
                        {format(d, 'd')}
                      </span>
                      {events.length > 0 && (
                        <div className="space-y-0.5">
                          {events.slice(0, 3).map((trip) => (
                            <div
                              key={trip.id}
                              className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${CAL_STATUS_COLORS[trip.status] || 'bg-muted'}`}
                            >
                              {trip.name}
                            </div>
                          ))}
                          {events.length > 3 && (
                            <span className="text-[10px] text-blue-600 dark:text-blue-300 font-medium">
                              {t('dashboard.moreCount', { count: events.length - 3 })}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
            <Card className="bg-card p-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
                {calSelectedDate ? format(calSelectedDate, 'MMMM d, yyyy') : t('reservations.selectDate')}
              </h3>
              {calSelectedEvents.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">{t('calendarView.noTripsOnDate')}</p>
              )}
              <div className="space-y-2">
                {calSelectedEvents.map((trip) => (
                  <a
                    key={trip.id}
                    href={createPageUrl(`ReservationDetails?id=${trip.id}`)}
                    className="block p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Plane className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{trip.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                      <span>{trip.destination}</span>
                      {trip.client_name && (
                        <>
                          <span>·</span>
                          <span>{trip.client_name}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge className={`text-[10px] ${CAL_STATUS_COLORS[trip.status] || ''}`}>
                        {trip.status === 'confirmed'
                          ? t('common.confirmed')
                          : trip.status === 'cancelled'
                            ? t('common.cancelled')
                            : t(`tripStatus.${trip.status}`)}
                      </Badge>
                      {trip.end_date && (
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(trip.start_date), 'MMM d')} – {format(new Date(trip.end_date), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <CurrencyConverter />

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                selectedCount === 1 ? 'reservations.deleteDialogTitleSingular' : 'reservations.deleteDialogTitlePlural',
                { count: selectedCount },
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('reservations.deleteDialogBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>{t('reservations.keepReservations')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isBulkDeleting
                ? t('reservations.deleting')
                : t(selectedCount === 1 ? 'reservations.yesDeleteSingular' : 'reservations.yesDeletePlural', {
                    count: selectedCount,
                  })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
