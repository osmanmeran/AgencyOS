import { db } from '@/lib/DbContext';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { eachDayOfInterval, parseISO, format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft,
  Plus,
  MapPin,
  Clock,
  Trash2,
  Edit2,
  CalendarDays,
  Building2,
  Star,
  Search,
  ChevronLeft,
  ChevronRight,
  Plane,
  Hotel,
  Car,
  Activity,
  Utensils,
  Camera,
  X,
  Check,
  CalendarOff,
} from 'lucide-react';
import { categoryIdsBySupplier, getSupplierCategoryIds } from '@/lib/supplierCategories';
import { getBlockingStopSale } from '@/lib/supplierStopSales';
import { getCurrencySymbol } from '@/lib/formatters';
import { useT } from '@/lib/i18n/I18nContext';

const CATEGORY_ICONS = {
  flight: {
    icon: Plane,
    color: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  },
  hotel: {
    icon: Hotel,
    color:
      'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  transfer: { icon: Car, color: 'bg-muted text-muted-foreground border-border' },
  activity: {
    icon: Activity,
    color:
      'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  },
  restaurant: {
    icon: Utensils,
    color: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
  sightseeing: {
    icon: Camera,
    color:
      'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
};

function detectCategory(title = '', desc = '') {
  const t = (title + ' ' + desc).toLowerCase();
  if (t.includes('flight') || t.includes('airport')) return 'flight';
  if (t.includes('hotel') || t.includes('check-in') || t.includes('resort')) return 'hotel';
  if (t.includes('transfer') || t.includes('taxi') || t.includes('pickup')) return 'transfer';
  if (t.includes('lunch') || t.includes('dinner') || t.includes('restaurant') || t.includes('breakfast'))
    return 'restaurant';
  if (t.includes('tour') || t.includes('museum') || t.includes('sightseeing')) return 'sightseeing';
  return 'activity';
}

const EMPTY_FORM = {
  title: '',
  date: '',
  time: '',
  location: '',
  description: '',
  supplier_id: '',
  service_id: '',
  pricing_id: '',
  quantity: 1,
  cost: '',
  supplier_cost: '',
};

export default function ItineraryBuilder() {
  const { t: _t } = useT();
  const [selectedTripId, setSelectedTripId] = useState('');
  const [dayOffset, setDayOffset] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [_selectedDay, setSelectedDay] = useState(null);
  const queryClient = useQueryClient();

  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({ queryKey: ['trips'], queryFn: () => db.entities.Trip.list('-start_date') })
  );
  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({ queryKey: ['suppliers'], queryFn: () => db.entities.Supplier.list() })
  );
  const { data: allServices = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({ queryKey: ['supplierServices'], queryFn: () => db.entities.SupplierService.list() })
  );
  const { data: allPricings = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({ queryKey: ['supplierPricings'], queryFn: () => db.entities.SupplierPricing.list() })
  );
  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({ queryKey: ['supplierCategories'], queryFn: () => db.entities.SupplierCategory.list() })
  );
  const { data: subcategories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({ queryKey: ['allSupplierSubcategories'], queryFn: () => db.entities.SupplierSubcategory.list() })
  );
  const supplierCategoryMap = categoryIdsBySupplier(subcategories);

  const { data: stopSales = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({ queryKey: ['allSupplierStopSales'], queryFn: () => db.entities.SupplierStopSale.list() })
  );

  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  const { data: events = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['itineraryEvents', selectedTripId],
      queryFn: () => db.entities.ItineraryEvent.filter({ trip_id: selectedTripId }),
      enabled: !!selectedTripId,
    })
  );

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.ItineraryEvent.create({ ...data, trip_id: selectedTripId }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['itineraryEvents', selectedTripId] });
        closeModal();
      },
    })
  );
  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) => db.entities.ItineraryEvent.update(id, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['itineraryEvents', selectedTripId] });
        closeModal();
      },
    })
  );
  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.ItineraryEvent.delete(id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['itineraryEvents', selectedTripId] }),
    })
  );

  // Days of trip
  const tripDays = useMemo(() => {
    if (!selectedTrip) return [];
    return eachDayOfInterval({ start: parseISO(selectedTrip.start_date), end: parseISO(selectedTrip.end_date) });
  }, [selectedTrip]);

  // Visible days window (5 at a time)
  const VISIBLE = 5;
  const visibleDays = tripDays.slice(dayOffset, dayOffset + VISIBLE);

  // Events grouped by date string
  const eventsByDate = useMemo(() => {
    return events.reduce((acc, e) => {
      if (!acc[e.date]) acc[e.date] = [];
      acc[e.date].push(e);
      return acc;
    }, {});
  }, [events]);

  // Filtered suppliers for the picker
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers.slice(0, 20);
    const q = supplierSearch.toLowerCase();
    return suppliers.filter((s) => s.name?.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q));
  }, [suppliers, supplierSearch]);

  const openAddModal = (date) => {
    setEditingEvent(null);
    setFormData({ ...EMPTY_FORM, date: format(date, 'yyyy-MM-dd') });
    setSelectedDay(date);
    setSupplierSearch('');
    setModalOpen(true);
  };

  const openEditModal = (event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title || '',
      date: event.date || '',
      time: event.time || '',
      location: event.location || '',
      description: event.description || '',
      supplier_id: event.supplier_id || '',
      service_id: event.service_id || '',
      pricing_id: event.pricing_id || '',
      quantity: event.quantity || 1,
      cost: event.cost || '',
      supplier_cost: event.supplier_cost || '',
    });
    const supplier = suppliers.find((s) => s.id === event.supplier_id);
    setSupplierSearch(supplier?.name || '');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingEvent(null);
    setFormData(EMPTY_FORM);
    setSupplierSearch('');
  };

  const selectSupplier = (supplier) => {
    const supplierServices = allServices.filter((s) => s.supplier_id === supplier.id);
    const location = supplier.city || supplier.address || '';
    setFormData((f) => ({
      ...f,
      supplier_id: supplier.id,
      location: f.location || location,
      description: f.description || (supplier.pricing_info ? supplier.pricing_info.slice(0, 200) : ''),
      service_id: supplierServices[0]?.id || '',
      pricing_id: '',
    }));
    setSupplierSearch(supplier.name);
  };

  const handlePricingChange = (pricingId) => {
    const pricing = allPricings.find((p) => p.id === pricingId);
    if (pricing) {
      const cp =
        pricing.client_price > 0
          ? pricing.client_price
          : pricing.base_price * (1 + (pricing.markup_percentage || 0) / 100);
      setFormData(
        /** @type {any} */ (
          (f) => ({
            ...f,
            pricing_id: pricingId,
            supplier_id: f.supplier_id || pricing.supplier_id,
            supplier_cost: pricing.base_price * (f.quantity || 1),
            cost: cp * (f.quantity || 1),
          })
        ),
      );
    }
  };

  const eventStopSale = getBlockingStopSale(stopSales, formData.supplier_id, formData.date, formData.date);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (eventStopSale) return;
    const data = {
      ...formData,
      cost: formData.cost ? parseFloat(formData.cost) : undefined,
      supplier_cost: formData.supplier_cost ? parseFloat(formData.supplier_cost) : undefined,
    };
    if (editingEvent) updateMutation.mutate({ id: editingEvent.id, data });
    else createMutation.mutate(data);
  };

  const selectedSupplier = suppliers.find((s) => s.id === formData.supplier_id);
  const supplierServices = allServices.filter((s) => s.supplier_id === formData.supplier_id);
  const supplierPricings = allPricings.filter((p) => p.supplier_id === formData.supplier_id && p.is_active !== false);
  const supplierCategories = selectedSupplier
    ? categories.filter((c) => getSupplierCategoryIds(supplierCategoryMap, selectedSupplier.id).includes(c.id))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl('Reservations')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-blue-600 dark:text-blue-300" />
              {_t('itineraryBuilder.itinerary')}
            </h1>
            <p className="text-muted-foreground text-sm">{_t('itineraryBuilder.map')}</p>
          </div>
        </div>

        <div className="w-80">
          <Select
            value={selectedTripId}
            onValueChange={(v) => {
              setSelectedTripId(v);
              setDayOffset(0);
            }}
          >
            <SelectTrigger className="bg-card shadow-sm">
              <SelectValue placeholder={_t('itineraryBuilder.select')} />
            </SelectTrigger>
            <SelectContent>
              {trips.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.destination} · {format(parseISO(t.start_date), 'MMM d')}–
                      {format(parseISO(t.end_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedTrip ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{_t('itineraryBuilder.selectA')}</h2>
            <p className="text-muted-foreground max-w-sm text-sm">{_t('itineraryBuilder.choose')}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Trip info bar */}
          <Card className="p-4 bg-gradient-to-r from-blue-50 dark:from-blue-950/40 to-indigo-50 dark:to-indigo-950/40 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-semibold">
                  <MapPin className="w-4 h-4" />
                  {selectedTrip.destination}
                </div>
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-300 text-sm">
                  <Clock className="w-3.5 h-3.5" />
                  {format(parseISO(selectedTrip.start_date), 'MMM d')} –{' '}
                  {format(parseISO(selectedTrip.end_date), 'MMM d, yyyy')}
                  <span className="text-blue-400">
                    · {tripDays.length} {_t('itineraryBuilder.day')}
                    {tripDays.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <Badge className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                  {selectedTrip.status}
                </Badge>
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-300 font-medium">
                {events.length} {_t('itineraryBuilder.event')}
                {events.length !== 1 ? 's' : ''} {_t('itineraryBuilder.planned')}
              </div>
            </div>
          </Card>

          {/* Day columns navigator */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDayOffset(Math.max(0, dayOffset - 1))}
              disabled={dayOffset === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="flex-1 grid gap-3" style={{ gridTemplateColumns: `repeat(${visibleDays.length}, 1fr)` }}>
              {visibleDays.map((day, idx) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayEvents = (eventsByDate[dateKey] || []).sort((a, b) =>
                  (a.time || '').localeCompare(b.time || ''),
                );
                const dayNum = dayOffset + idx + 1;

                return (
                  <div key={dateKey} className="flex flex-col min-h-[400px]">
                    {/* Day header */}
                    <div className="bg-blue-600 text-white rounded-t-xl px-3 py-2.5 flex items-center justify-between">
                      <div>
                        <div className="text-xs opacity-75">
                          {_t('itineraryBuilder.day_2')} {dayNum}
                        </div>
                        <div className="font-bold text-sm">{format(day, 'EEE, MMM d')}</div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-white hover:bg-blue-500"
                        onClick={() => openAddModal(day)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Events */}
                    <div className="flex-1 bg-muted rounded-b-xl border border-t-0 border-border p-2 space-y-2">
                      {dayEvents.length === 0 ? (
                        <button
                          onClick={() => openAddModal(day)}
                          className="w-full h-full min-h-[80px] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors text-xs"
                        >
                          <Plus className="w-4 h-4" />
                          {_t('itineraryBuilder.add_2')}
                        </button>
                      ) : (
                        <>
                          {dayEvents.map((event) => {
                            const cat = detectCategory(event.title, event.description);
                            const catConfig = CATEGORY_ICONS[cat];
                            const CatIcon = catConfig.icon;
                            const supplier = suppliers.find((s) => s.id === event.supplier_id);
                            return (
                              <div
                                key={event.id}
                                className="bg-card rounded-lg border border-border p-2.5 shadow-sm group hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-md transition-all"
                              >
                                <div className="flex items-start justify-between gap-1 mb-1">
                                  <div className={`p-1 rounded-md ${catConfig.color}`}>
                                    <CatIcon className="w-3 h-3" />
                                  </div>
                                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => openEditModal(event)}
                                      className="p-1 hover:text-blue-600 dark:hover:text-blue-300 text-muted-foreground rounded"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => deleteMutation.mutate(event.id)}
                                      className="p-1 hover:text-red-500 dark:hover:text-red-300 text-muted-foreground rounded"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                {event.time && (
                                  <div className="text-xs text-blue-600 dark:text-blue-300 font-medium mb-0.5">
                                    {event.time}
                                  </div>
                                )}
                                <div className="text-xs font-semibold text-foreground leading-tight line-clamp-2">
                                  {event.title}
                                </div>
                                {event.location && (
                                  <div className="flex items-center gap-0.5 text-muted-foreground text-xs mt-1 truncate">
                                    <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                                    <span className="truncate">{event.location}</span>
                                  </div>
                                )}
                                {supplier && (
                                  <div className="flex items-center gap-0.5 text-xs text-blue-500 dark:text-blue-300 mt-1 truncate">
                                    <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
                                    <span className="truncate">{supplier.name}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <button
                            onClick={() => openAddModal(day)}
                            className="w-full border border-dashed border-border rounded-lg py-1.5 flex items-center justify-center gap-1 text-muted-foreground hover:border-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors text-xs"
                          >
                            <Plus className="w-3 h-3" /> {_t('itineraryBuilder.add_2')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setDayOffset(Math.min(tripDays.length - VISIBLE, dayOffset + 1))}
              disabled={dayOffset + VISIBLE >= tripDays.length}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Pagination dots */}
          {tripDays.length > VISIBLE && (
            <div className="flex justify-center gap-1.5">
              {Array.from({ length: Math.ceil(tripDays.length / VISIBLE) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setDayOffset(i * VISIBLE)}
                  className={`w-2 h-2 rounded-full transition-colors ${Math.floor(dayOffset / VISIBLE) === i ? 'bg-blue-600' : 'bg-muted-foreground/40'}`}
                />
              ))}
            </div>
          )}

          {/* Full itinerary summary */}
          {events.length > 0 && (
            <Card className="p-5">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                {_t('itineraryBuilder.full')}
              </h3>
              <div className="space-y-5">
                {Object.keys(eventsByDate)
                  .sort()
                  .map((dateKey, idx) => {
                    const dayEvents = eventsByDate[dateKey].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
                    return (
                      <div key={dateKey}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold text-white bg-blue-600 px-2.5 py-1 rounded-full">
                            {_t('itineraryBuilder.day_2')} {idx + 1} · {format(parseISO(dateKey), 'EEE, MMM d')}
                          </span>
                          <div className="flex-1 h-px bg-muted" />
                        </div>
                        <div className="space-y-2 ml-2 pl-4 border-l-2 border-blue-100">
                          {dayEvents.map((event) => {
                            const supplier = suppliers.find((s) => s.id === event.supplier_id);
                            const cat = detectCategory(event.title, event.description);
                            const catConfig = CATEGORY_ICONS[cat];
                            const CatIcon = catConfig.icon;
                            return (
                              <div
                                key={event.id}
                                className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-muted group"
                              >
                                <div className={`p-1.5 rounded-lg mt-0.5 ${catConfig.color}`}>
                                  <CatIcon className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {event.time && (
                                      <span className="text-xs text-blue-600 dark:text-blue-300 font-medium">
                                        {event.time}
                                      </span>
                                    )}
                                    <span className="font-medium text-sm text-foreground">{event.title}</span>
                                  </div>
                                  {event.location && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                      <MapPin className="w-3 h-3" />
                                      {event.location}
                                    </div>
                                  )}
                                  {supplier && (
                                    <div className="flex items-center gap-1 text-xs text-blue-500 dark:text-blue-300 mt-0.5">
                                      <Building2 className="w-3 h-3" />
                                      {supplier.name}
                                    </div>
                                  )}
                                  {event.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                      {event.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => openEditModal(event)}
                                    className="p-1 hover:text-blue-600 dark:hover:text-blue-300 text-muted-foreground rounded text-xs"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteMutation.mutate(event.id)}
                                    className="p-1 hover:text-red-500 dark:hover:text-red-300 text-muted-foreground rounded"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                {(event.cost || event.supplier_cost) && (
                                  <div className="text-right text-xs flex-shrink-0">
                                    {event.cost && (
                                      <div className="font-semibold text-green-600 dark:text-green-300">
                                        {getCurrencySymbol(selectedTrip?.selling_currency || 'USD')}
                                        {parseFloat(event.cost).toFixed(0)}
                                      </div>
                                    )}
                                    {event.supplier_cost && (
                                      <div className="text-muted-foreground">
                                        {_t('itineraryBuilder.cost')}{' '}
                                        {getCurrencySymbol(selectedTrip?.acquiring_currency || 'USD')}
                                        {parseFloat(event.supplier_cost).toFixed(0)}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Add / Edit Event Modal */}
      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-300" />
              {editingEvent ? 'Edit Event' : 'Add Event'}
              {formData.date && (
                <Badge variant="outline" className="ml-2 font-normal">
                  {format(parseISO(formData.date), 'EEE, MMM d')}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 mt-2">
            {/* Title + Time */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>{_t('itineraryBuilder.eventTitle')}</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                  placeholder={_t('itineraryBuilder.e')}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>{_t('itineraryBuilder.time')}</Label>
                <Input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData((f) => ({ ...f, time: e.target.value }))}
                />
              </div>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label>{_t('itineraryBuilder.date')}</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))}
                min={selectedTrip?.start_date}
                max={selectedTrip?.end_date}
                required
              />
            </div>

            {/* Supplier Picker */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-300" />
                {_t('itineraryBuilder.link')}
              </Label>

              {selectedSupplier ? (
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex-1">
                    <div className="font-semibold text-foreground text-sm">{selectedSupplier.name}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {supplierCategories.length > 0 && (
                        <span className="text-blue-600 dark:text-blue-300">
                          {supplierCategories.map((c) => c.name).join(', ')}
                        </span>
                      )}
                      {selectedSupplier.city && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {selectedSupplier.city}
                        </span>
                      )}
                      {selectedSupplier.rating && (
                        <span className="flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 text-amber-500 dark:text-amber-300" />
                          {selectedSupplier.rating}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((f) => ({
                        ...f,
                        supplier_id: '',
                        service_id: '',
                        pricing_id: '',
                        cost: '',
                        supplier_cost: '',
                      }));
                      setSupplierSearch('');
                    }}
                    className="text-muted-foreground hover:text-red-500 dark:hover:text-red-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={supplierSearch}
                      onChange={(e) => setSupplierSearch(e.target.value)}
                      placeholder={_t('itineraryBuilder.search')}
                      className="pl-9"
                    />
                  </div>
                  {supplierSearch && (
                    <div className="border border-border rounded-lg max-h-40 overflow-y-auto bg-card shadow-lg">
                      {filteredSuppliers.length === 0 ? (
                        <div className="p-3 text-center text-sm text-muted-foreground">{_t('itineraryBuilder.no')}</div>
                      ) : (
                        filteredSuppliers.map((s) => {
                          const cat = categories.find((c) =>
                            getSupplierCategoryIds(supplierCategoryMap, s.id).includes(c.id),
                          );
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => selectSupplier(s)}
                              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors border-b border-border last:border-0"
                            >
                              <div className="font-medium text-foreground text-sm">{s.name}</div>
                              <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                                {cat && <span className="text-blue-600 dark:text-blue-300">{cat.name}</span>}
                                {s.city && <span>{s.city}</span>}
                                {s.rating && (
                                  <span className="flex items-center gap-0.5">
                                    <Star className="w-2.5 h-2.5 text-amber-400" />
                                    {s.rating}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Service + Pricing (only when supplier selected) */}
            {selectedSupplier && (
              <div className="grid grid-cols-2 gap-3">
                {supplierServices.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>{_t('itineraryBuilder.service')}</Label>
                    <Select
                      value={formData.service_id}
                      onValueChange={(v) => setFormData((f) => ({ ...f, service_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={_t('itineraryBuilder.selectService')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>{_t('itineraryBuilder.none')}</SelectItem>
                        {supplierServices.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.service_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {supplierPricings.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>{_t('itineraryBuilder.price')}</Label>
                    <Select value={formData.pricing_id} onValueChange={handlePricingChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={_t('itineraryBuilder.selectPricing')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>{_t('itineraryBuilder.none')}</SelectItem>
                        {supplierPricings.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} — ${p.base_price} {p.unit ? `/ ${p.unit.replace('_', ' ')}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Location */}
            <div className="space-y-1.5">
              <Label>{_t('itineraryBuilder.location')}</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData((f) => ({ ...f, location: e.target.value }))}
                placeholder={_t('itineraryBuilder.address')}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>{_t('itineraryBuilder.description')}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                placeholder={_t('itineraryBuilder.details')}
                rows={3}
              />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-3 gap-3 bg-muted p-4 rounded-lg border border-border">
              <div className="space-y-1.5">
                <Label>{_t('itineraryBuilder.qty')}</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData((f) => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground">{_t('itineraryBuilder.supplier')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.supplier_cost}
                  onChange={(e) => setFormData((f) => ({ ...f, supplier_cost: e.target.value }))}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">{_t('itineraryBuilder.what')}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-blue-700 dark:text-blue-300">{_t('itineraryBuilder.client')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData((f) => ({ ...f, cost: e.target.value }))}
                  placeholder="0.00"
                  className="border-blue-300 dark:border-blue-800"
                />
                <p className="text-xs text-muted-foreground">{_t('itineraryBuilder.whatYou')}</p>
              </div>
            </div>

            {eventStopSale && (
              <p className="text-xs text-red-600 dark:text-red-300 flex items-center gap-1 font-medium">
                <CalendarOff className="w-3.5 h-3.5 flex-shrink-0" />
                {selectedSupplier?.name} {_t('itineraryBuilder.is')} {eventStopSale.start_date} –{' '}
                {eventStopSale.end_date}
                {eventStopSale.reason ? ` (${eventStopSale.reason})` : ''} — {_t('itineraryBuilder.pick')}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeModal}>
                {_t('itineraryBuilder.cancel')}
              </Button>
              <Button type="submit" disabled={!!eventStopSale}>
                <Check className="w-4 h-4 mr-1" />
                {editingEvent ? 'Update Event' : 'Add Event'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
