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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, CalendarCheck, Clock, CheckCircle, XCircle, Send, Search, MapPin, Calendar, Users, Trash2, Download, ChevronLeft, ChevronRight, Plane, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format, parseISO, isBefore, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import CurrencyConverter from '../components/currency/CurrencyConverter';
import PastReservationsSearch from '../components/reservations/PastReservationsSearch';
import BulkActionsBar from '@/components/shared/BulkActionsBar';
import { useT } from '@/lib/i18n/I18nContext';
import { showSuccess, showError } from '@/lib/toast';

const currSymbol = (cur) => ({ USD: '$', EUR: '€', GBP: '£', TRY: '₺', AED: 'د.إ', SAR: '﷼', EGP: 'E£', MAD: 'MAD', JPY: '¥', CHF: 'CHF', CAD: 'CA$', AUD: 'A$' }[cur] || cur);

const PROPOSAL_STATUS_CONFIG = {
  pending:   { color: 'bg-amber-100 text-amber-800',  icon: Clock },
  sent:      { color: 'bg-blue-100 text-blue-800',    icon: Send },
  confirmed: { color: 'bg-green-100 text-green-800',  icon: CheckCircle },
  rejected:  { color: 'bg-red-100 text-red-800',      icon: XCircle },
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
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect(trip.id); }}
        >
          <Checkbox checked={selected} />
        </div>
      )}
      <Link to={createPageUrl(`ReservationDetails?id=${trip.id}`)}>
        <Card className={`p-5 bg-white hover:shadow-xl transition-all cursor-pointer group border-l-4 border-l-transparent hover:border-l-blue-500 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
          <div className="flex justify-between items-start mb-3">
            <div className={`flex-1 min-w-0 ${onToggleSelect ? 'pl-7' : ''}`}>
              <h3 className="font-bold text-slate-900 text-lg truncate group-hover:text-blue-600 transition-colors">{trip.name}</h3>
              {trip.reference_number && <span className="text-xs font-mono text-slate-400">{trip.reference_number}</span>}
            </div>
            <Badge className={`${statusConf.color} flex items-center gap-1 ml-2 flex-shrink-0`}>
              <StatusIcon className="w-3 h-3" />{t(`common.${trip.proposal_status || 'pending'}`)}
            </Badge>
          </div>

          <div className="space-y-1.5 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{trip.destination}</span>
            </div>
            {trip.start_date && trip.end_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{format(new Date(trip.start_date), 'MMM d')} – {format(new Date(trip.end_date), 'MMM d, yyyy')}</span>
              </div>
            )}
            {trip.client_name && (
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{trip.client_name}{paxCount > 0 ? ` · ${paxCount} pax` : ''}</span>
              </div>
            )}
          </div>

          {trip.total_cost > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">Total</span>
              <span className="font-bold text-green-700">{sc}{trip.total_cost.toFixed(2)}</span>
            </div>
          )}
        </Card>
      </Link>
    </div>
  );
}

const CAL_STATUS_COLORS = {
  planning: 'bg-amber-100 text-amber-800 border-amber-300',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
  in_progress: 'bg-green-100 text-green-800 border-green-300',
  completed: 'bg-slate-100 text-slate-600 border-slate-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
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
    items: trips, total, search, setSearch, isLoading, isFetching,
  } = usePaginatedEntities('Trip', { pageSize: 200, sort: 'start_date' });

  const currentTrips = trips.filter(t => {
    if (!t.end_date) return true;
    return !isBefore(parseISO(t.end_date), today);
  });

  const filtered = currentTrips;

  const byStatus = (status) => filtered.filter(t => (t.proposal_status || 'pending') === status);

  const isCancelled = (t) => t.proposal_status === 'rejected' || t.status === 'cancelled';

  const cancelledTrips = trips.filter(t => isCancelled(t));
  const cancelledCount = cancelledTrips.length;

  const { selectedIds, toggle, toggleAll, clear, allSelected, count: selectedCount } = useSelection(filtered);

  const deleteCancelledMutation = /** @type {any} */ (useMutation({
    mutationFn: () => db.entities.Trip.bulkDelete(cancelledTrips.map(t => t.id)),
    onSuccess: () => {
      showSuccess('Cancelled reservations deleted');
      queryClient.invalidateQueries({ queryKey: ['Trip'] });
    },
    onError: (error) => showError('Failed to delete cancelled reservations', error.message)
  }));

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const result = await db.entities.Trip.bulkDelete([...selectedIds]);
      if (result.skipped.length > 0) {
        showError(`${result.skipped.length} reservation(s) could not be deleted`, 'You may not have permission for some of the selected reservations.');
      } else {
        showSuccess('Reservations deleted');
      }
      clear();
      setBulkDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ['Trip'] });
    } catch (error) {
      showError('Failed to delete reservations', error.message);
    }
    setIsBulkDeleting(false);
  };

  const handleBulkStatusChange = async (proposal_status) => {
    setIsBulkUpdating(true);
    try {
      const ids = [...selectedIds];
      await db.entities.Trip.bulkUpdate(ids, { proposal_status });
      showSuccess(`Updated ${ids.length} reservation${ids.length > 1 ? 's' : ''} to "${proposal_status}"`);
      clear();
      queryClient.invalidateQueries({ queryKey: ['Trip'] });
    } catch (error) {
      showError('Failed to update reservations', error.message);
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
        { label: 'Total Cost', accessor: (t) => t.total_cost }
      ]);
    } catch (error) {
      showError('Failed to export reservations', error.message);
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
  while (calDay <= calEnd) { calDays.push(calDay); calDay = addDays(calDay, 1); }

  const calEventsByDate = useMemo(() => {
    const map = {};
    trips.forEach(trip => {
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
          <CalendarCheck className="w-12 h-12 text-blue-600 animate-bounce mx-auto mb-4" />
          <p className="text-slate-600">{t('reservations.loadingReservations')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-1">{t('reservations.title')}</h1>
          <p className="text-slate-500">{t('reservations.subtitle')}</p>
        </div>
        <Link to={createPageUrl('CreateReservation')}>
          <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-600/30" size="lg">
            <Plus className="w-5 h-5 mr-2" />{t('reservations.newReservation')}
          </Button>
        </Link>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(PROPOSAL_STATUS_CONFIG).map(([key, conf]) => {
          const count = key === 'rejected' ? cancelledCount : currentTrips.filter(t => (t.proposal_status || 'pending') === key).length;
          const Icon = conf.icon;
          if (key === 'rejected') {
            return (
              <div key={key} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
                <XCircle className="w-3.5 h-3.5" />Cancelled: {cancelledCount}
              </div>
            );
          }
          return (
            <div key={key} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${conf.color}`}>
              <Icon className="w-3.5 h-3.5" />{t(`common.${key}`)}: {count}
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <TabsList className="bg-white border border-slate-200 p-1">
            <TabsTrigger value="all" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">{t('common.all')} ({filtered.length})</TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">{t('common.pending')} ({byStatus('pending').length})</TabsTrigger>
            <TabsTrigger value="sent" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">{t('common.sent')} ({byStatus('sent').length})</TabsTrigger>
            <TabsTrigger value="confirmed" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">{t('common.confirmed')} ({byStatus('confirmed').length})</TabsTrigger>
            <TabsTrigger value="rejected" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
              Cancelled ({cancelledCount})
            </TabsTrigger>
            <TabsTrigger value="past" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">{t('reservations.past')}</TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white"><Calendar className="w-3.5 h-3.5 mr-1" />Calendar</TabsTrigger>
          </TabsList>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('reservations.searchPlaceholder')} className="pl-9 pr-9" />
            {isFetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
          </div>
          <Button variant="outline" size="sm" onClick={toggleAll}>
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>
          <Button variant="outline" onClick={handleExportAll} disabled={isExporting}>
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Export CSV
          </Button>
        </div>

        <BulkActionsBar count={selectedCount} label="reservation" onDeselectAll={clear}>
          <Select onValueChange={handleBulkStatusChange} disabled={isBulkUpdating}>
            <SelectTrigger className="w-44 h-9 bg-white">
              <SelectValue placeholder="Change status" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(PROPOSAL_STATUS_CONFIG).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setBulkDeleteOpen(true)}>
            <XCircle className="w-4 h-4 mr-2" />
            Delete {selectedCount}
          </Button>
        </BulkActionsBar>

        {['all', 'pending', 'sent', 'confirmed', 'rejected'].map(tab => {
          const list = tab === 'all' ? filtered : tab === 'rejected' ? trips.filter(t => isCancelled(t)) : byStatus(tab);
          return (
            <TabsContent key={tab} value={tab}>
              {list.length === 0 ? (
                <div className="text-center py-16">
                  <div className="bg-white rounded-2xl p-10 max-w-sm mx-auto shadow-sm">
                    <CalendarCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">{t('reservations.noReservations', { status: tab === 'all' ? '' : tab })}</p>
                    {tab === 'all' && (
                      <Link to={createPageUrl('CreateReservation')}>
                        <Button className="mt-4 bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />{t('reservations.createFirst')}</Button>
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
                        {groupOrder.map(key => {
                          const date = new Date(key + 'T00:00:00');
                          return (
                            <div key={key} className="mb-8">
                              <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-blue-200">
                                <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold">
                                  {format(date, 'd')}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">{format(date, 'EEEE, MMM d, yyyy')}</div>
                                  <div className="text-xs text-slate-500">{grouped[key].length} reservation{grouped[key].length !== 1 ? 's' : ''}</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {grouped[key].map(trip => <ReservationCard key={trip.id} trip={trip} selected={selectedIds.has(trip.id)} onToggleSelect={toggle} />)}
                              </div>
                            </div>
                          );
                        })}
                        {grouped['__unscheduled'] && (
                          <div className="mb-8">
                            <div className="flex items-center gap-3 mb-4 pb-2 border-b-2 border-slate-200">
                              <div className="bg-slate-400 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold">
                                ∞
                              </div>
                              <div className="font-bold text-slate-500">Unscheduled</div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                              {grouped['__unscheduled'].map(trip => <ReservationCard key={trip.id} trip={trip} selected={selectedIds.has(trip.id)} onToggleSelect={toggle} />)}
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
                          if (confirm(`Permanently erase all ${cancelledCount} cancelled reservations? This cannot be undone.`)) {
                            deleteCancelledMutation.mutate();
                          }
                        }}
                        disabled={deleteCancelledMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {deleteCancelledMutation.isPending ? 'Erasing...' : `Erase All Cancelled (${cancelledCount})`}
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
            <Card className="lg:col-span-2 bg-white p-4">
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={() => setCalMonth(subMonths(calMonth, 1))}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-lg font-semibold">{format(calMonth, 'MMMM yyyy')}</h2>
                <Button variant="ghost" size="icon" onClick={() => setCalMonth(addMonths(calMonth, 1))}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="bg-slate-50 px-2 py-1.5 text-center text-xs font-semibold text-slate-500">{d}</div>
                ))}
                {calDays.map(d => {
                  const dateStr = format(d, 'yyyy-MM-dd');
                  const events = calEventsByDate[dateStr] || [];
                  const isCurrent = isSameDay(d, new Date());
                  const isSelected = calSelectedDate && isSameDay(d, calSelectedDate);
                  const inMonth = isSameMonth(d, calMonth);
                  return (
                    <button key={dateStr}
                      onClick={() => setCalSelectedDate(calSelectedDate && isSameDay(d, calSelectedDate) ? null : d)}
                      className={`bg-white min-h-[80px] p-1.5 text-left transition-colors ${!inMonth ? 'opacity-40' : ''} ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''} hover:bg-blue-50`}>
                      <span className={`text-xs font-medium mb-1 block ${isCurrent ? 'bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center' : 'text-slate-600'}`}>
                        {format(d, 'd')}
                      </span>
                      {events.length > 0 && (
                        <div className="space-y-0.5">
                          {events.slice(0, 3).map(trip => (
                            <div key={trip.id} className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${CAL_STATUS_COLORS[trip.status] || 'bg-slate-100'}`}>
                              {trip.name}
                            </div>
                          ))}
                          {events.length > 3 && <span className="text-[10px] text-blue-600 font-medium">+{events.length - 3} more</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
            <Card className="bg-white p-4">
              <h3 className="font-semibold text-sm text-slate-500 uppercase tracking-wider mb-3">
                {calSelectedDate ? format(calSelectedDate, 'MMMM d, yyyy') : 'Select a date'}
              </h3>
              {calSelectedEvents.length === 0 && <p className="text-sm text-slate-400 py-8 text-center">No trips on this date</p>}
              <div className="space-y-2">
                {calSelectedEvents.map(trip => (
                  <a key={trip.id} href={createPageUrl(`ReservationDetails?id=${trip.id}`)} className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <Plane className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-sm">{trip.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                      <span>{trip.destination}</span>
                      {trip.client_name && <><span>·</span><span>{trip.client_name}</span></>}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge className={`text-[10px] ${CAL_STATUS_COLORS[trip.status] || ''}`}>{trip.status?.replace('_', ' ')}</Badge>
                      {trip.end_date && (
                        <span className="text-[10px] text-slate-400">
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
            <AlertDialogTitle>Permanently Delete {selectedCount} Reservation{selectedCount > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>permanently delete</strong> all selected reservations from the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Keep Reservations</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isBulkDeleting ? 'Deleting...' : `Yes, Delete ${selectedCount} Reservation${selectedCount > 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}