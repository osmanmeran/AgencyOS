import { db } from '@/lib/DbContext';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrencySymbol } from '@/lib/formatters';
import { showSuccess, showError } from '@/lib/toast';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus,
  Edit,
  Trash2,
  Map as TourIcon,
  Bus,
  Users,
  MapPin,
  Clock,
  Utensils,
  Hotel,
  X,
  Repeat,
  CalendarCheck,
  Star,
  Tag,
} from 'lucide-react';
import { usePermissions } from '@/components/permissions/PermissionContext';
import { useT } from '@/lib/i18n/I18nContext';
import ImageUpload from './ImageUpload';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'tr', label: 'Türkçe' },
];

const MEAL_TREATMENTS = [
  'Not included',
  'Breakfast included',
  'Lunch included',
  'Dinner included',
  'Half board',
  'Full board',
];

function emptyForm(mode) {
  return {
    name: '',
    mode,
    supplierId: '',
    supplierName: '',
    language: 'en',
    location: '',
    startingTime: '',
    sights: [],
    mealTreatment: 'Not included',
    pricingTiers: [],
    transportation: false,
    tourStyle: 'regular',
    minOccupancy: 1,
    maxOccupancy: 1,
    startLocation: '',
    endLocation: '',
    nights: [],
    departureDate: '',
    availability: 1,
    repeatWeekly: false,
    repeatStart: '',
    repeatEnd: '',
    description: {},
    coverImage: '',
    durationDays: 1,
    dayDescriptions: [{ day: 1, description: '', image: '' }],
    featured: false,
    specialOffer: { percent: 0, startDate: '', endDate: '' },
  };
}

/** Keep dayDescriptions in sync with durationDays, preserving existing content. */
function syncDayDescriptions(dayDescriptions, durationDays) {
  const n = Math.max(1, Number(durationDays) || 1);
  const existing = Array.isArray(dayDescriptions) ? dayDescriptions : [];
  const next = [];
  for (let i = 0; i < n; i++) {
    next.push(existing[i] || { day: i + 1, description: '', image: '' });
  }
  return next;
}

/** Normalize a tour description into a localized map (object). */
function normalizeDescription(desc) {
  if (desc && typeof desc === 'object') return desc;
  if (typeof desc === 'string' && desc) return { en: desc };
  return {};
}

/** Resolve the best localized description for a language, with fallbacks. */
function resolveTourDescription(desc, lang) {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  if (typeof desc !== 'object') return '';
  return desc[lang] || desc.en || desc.it || Object.values(desc).find((v) => v) || '';
}

/** Languages offered in the multi-language description editor, in display order. */
const TOUR_DESC_LANGS = ['en', 'it', 'tr', 'es', 'fr', 'de'];

/** Local YYYY-MM-DD (avoids UTC off-by-one from toISOString). */
function ymd(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Weekly departure dates for a multi-day tour, or a single date if not repeating. */
function getDepartureDates(tour) {
  if (tour.repeatWeekly && tour.repeatStart && tour.repeatEnd) {
    const dates = [];
    let cur = new Date(tour.repeatStart);
    const end = new Date(tour.repeatEnd);
    if (!Number.isNaN(cur.getTime()) && !Number.isNaN(end.getTime())) {
      while (cur <= end) {
        dates.push(ymd(cur));
        cur.setDate(cur.getDate() + 7);
      }
      if (dates.length) return dates;
    }
  }
  return tour.departureDate ? [tour.departureDate] : [];
}

export default function GuidedTourManager({ mode }) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const isMultiDay = mode === 'multiday';

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm(mode));
  const [sightInput, setSightInput] = useState('');
  const [descLang, setDescLang] = useState('en');

  const { data: settings = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['appSettingsSingleton'],
      queryFn: () => db.entities.AppSettings.list(),
    })
  );
  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['tourSuppliers'],
      queryFn: () => db.entities.Supplier.list(),
    })
  );
  const currency = (settings && settings[0] && settings[0].defaultCurrency) || 'EUR';
  const symbol = getCurrencySymbol(currency);

  const { data: allTours = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['guidedTours'],
      queryFn: () => db.entities.GuidedTour.list(),
    })
  );
  const { data: allBookings = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['tourBookings'],
      queryFn: () => db.entities.TourBooking.list(),
    })
  );

  // Booked participants per `${tourId}|${departureDate}`.
  const bookedByDeparture = useMemo(() => {
    const map = {};
    for (const b of allBookings) {
      if (b.status === 'cancelled') continue;
      const key = `${b.tourId}|${b.departureDate}`;
      map[key] = (map[key] || 0) + (Number(b.participants) || 0);
    }
    return map;
  }, [allBookings]);

  const tours = useMemo(
    () =>
      allTours
        .filter((tour) => tour.mode === mode)
        .filter((tour) =>
          search
            ? (tour.name || '').toLowerCase().includes(search.toLowerCase()) ||
              (tour.location || '').toLowerCase().includes(search.toLowerCase()) ||
              (tour.startLocation || '').toLowerCase().includes(search.toLowerCase())
            : true,
        ),
    [allTours, mode, search],
  );

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.GuidedTour.create(data),
      onSuccess: () => {
        showSuccess(t('tours.created'));
        queryClient.invalidateQueries({ queryKey: ['guidedTours'] });
        closeModal();
      },
      onError: (error) => showError(t('tours.createError'), error.message),
    })
  );

  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) => db.entities.GuidedTour.update(id, data),
      onSuccess: () => {
        showSuccess(t('tours.updated'));
        queryClient.invalidateQueries({ queryKey: ['guidedTours'] });
        closeModal();
      },
      onError: (error) => showError(t('tours.updateError'), error.message),
    })
  );

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.GuidedTour.delete(id),
      onSuccess: () => {
        showSuccess(t('tours.deleted'));
        queryClient.invalidateQueries({ queryKey: ['guidedTours'] });
      },
      onError: (error) => showError(t('tours.deleteError'), error.message),
    })
  );

  const toggleFeaturedMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, featured }) => db.entities.GuidedTour.update(id, { featured }),
      onError: (error) => showError(t('tours.updateError'), error.message),
    })
  );

  // --- Booking dialog state ---
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingTour, setBookingTour] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    departureDate: '',
    participants: 1,
    customerName: '',
    status: 'confirmed',
  });

  const openBooking = (tour) => {
    const dates = getDepartureDates(tour);
    setBookingTour(tour);
    setBookingForm({
      departureDate: dates[0] || tour.departureDate || '',
      participants: 1,
      customerName: '',
      status: 'confirmed',
    });
    setBookingOpen(true);
  };

  const closeBooking = () => {
    setBookingOpen(false);
    setBookingTour(null);
  };

  const bookMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.TourBooking.create(data),
      onSuccess: () => {
        showSuccess(t('tours.bookingCreated') || 'Booking recorded');
        queryClient.invalidateQueries({ queryKey: ['tourBookings'] });
        closeBooking();
      },
      onError: (error) => showError(t('tours.bookingError') || 'Failed to record booking', error.message),
    })
  );

  const handleBookingSubmit = (e) => {
    e.preventDefault();
    if (!bookingTour) return;
    bookMutation.mutate({
      tourId: bookingTour.id,
      tourName: bookingTour.name,
      mode: bookingTour.mode,
      departureDate: bookingForm.departureDate,
      participants: Number(bookingForm.participants) || 1,
      customerName: bookingForm.customerName || '',
      status: bookingForm.status || 'confirmed',
    });
  };

  const openModal = (tour = null) => {
    if (tour) {
      setEditing(tour);
      setFormData({
        ...emptyForm(mode),
        ...tour,
        supplierId: tour.supplierId || '',
        supplierName: tour.supplierName || '',
        availability: tour.availability != null ? tour.availability : 1,
        repeatWeekly: !!tour.repeatWeekly,
        description: normalizeDescription(tour.description),
        coverImage: tour.coverImage || '',
        durationDays: tour.durationDays ? Number(tour.durationDays) : 1,
        dayDescriptions: syncDayDescriptions(tour.dayDescriptions, tour.durationDays),
        featured: !!tour.featured,
        specialOffer: tour.specialOffer
          ? {
              percent: Number(tour.specialOffer.percent) || 0,
              startDate: tour.specialOffer.startDate || '',
              endDate: tour.specialOffer.endDate || '',
            }
          : { percent: 0, startDate: '', endDate: '' },
        sights: Array.isArray(tour.sights) ? [...tour.sights] : [],
        pricingTiers: Array.isArray(tour.pricingTiers) ? [...tour.pricingTiers] : [],
        nights: Array.isArray(tour.nights) ? [...tour.nights] : [],
      });
    } else {
      setEditing(null);
      setFormData(emptyForm(mode));
    }
    setSightInput('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      minOccupancy: Number(formData.minOccupancy) || 1,
      maxOccupancy: Number(formData.maxOccupancy) || 1,
      pricingTiers: formData.pricingTiers.map((tier) => ({
        minParticipants: Number(tier.minParticipants) || 0,
        maxParticipants: Number(tier.maxParticipants) || 0,
        price: Number(tier.price) || 0,
      })),
      nights: isMultiDay
        ? formData.nights.map((n, i) => ({
            day: Number(n.day) || i + 1,
            lodging: n.lodging || '',
            hotelMealTreatment: n.hotelMealTreatment || '',
          }))
        : [],
      departureDate: isMultiDay ? formData.departureDate || '' : '',
      availability: isMultiDay ? Number(formData.availability) || 0 : 0,
      repeatWeekly: isMultiDay ? !!formData.repeatWeekly : false,
      repeatStart: isMultiDay && formData.repeatWeekly ? formData.repeatStart || '' : '',
      repeatEnd: isMultiDay && formData.repeatWeekly ? formData.repeatEnd || '' : '',
      description: formData.description || {},
      coverImage: formData.coverImage || '',
      durationDays: isMultiDay ? Number(formData.durationDays) || 1 : 0,
      dayDescriptions: isMultiDay
        ? syncDayDescriptions(formData.dayDescriptions, formData.durationDays).map((d, i) => ({
            day: i + 1,
            description: d.description || '',
            image: d.image || '',
          }))
        : [],
      featured: !!formData.featured,
      specialOffer: {
        percent: Number(formData.specialOffer?.percent) || 0,
        startDate: formData.specialOffer?.startDate || '',
        endDate: formData.specialOffer?.endDate || '',
      },
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const addSight = () => {
    const value = sightInput.trim();
    if (!value) return;
    setFormData((f) => ({ ...f, sights: [...f.sights, value] }));
    setSightInput('');
  };

  const removeSight = (index) => {
    setFormData((f) => ({ ...f, sights: f.sights.filter((_, i) => i !== index) }));
  };

  const addTier = () => {
    setFormData((f) => ({
      ...f,
      pricingTiers: [...f.pricingTiers, { minParticipants: '', maxParticipants: '', price: '' }],
    }));
  };

  const updateTier = (index, field, value) => {
    setFormData((f) => ({
      ...f,
      pricingTiers: f.pricingTiers.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier)),
    }));
  };

  const removeTier = (index) => {
    setFormData((f) => ({
      ...f,
      pricingTiers: f.pricingTiers.filter((_, i) => i !== index),
    }));
  };

  const addNight = () => {
    setFormData((f) => ({
      ...f,
      nights: [...f.nights, { day: f.nights.length + 1, lodging: '', hotelMealTreatment: '' }],
    }));
  };

  const updateNight = (index, field, value) => {
    setFormData((f) => ({
      ...f,
      nights: f.nights.map((n, i) => (i === index ? { ...n, [field]: value } : n)),
    }));
  };

  const removeNight = (index) => {
    setFormData((f) => ({
      ...f,
      nights: f.nights.filter((_, i) => i !== index).map((n, i) => ({ ...n, day: i + 1 })),
    }));
  };

  const canManage = hasPermission('manage_guided_tours');

  if (!canManage) {
    return (
      <Card className="p-12 text-center">
        <TourIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">{t('common.accessDenied')}</h3>
        <p className="text-muted-foreground">{t('tours.accessDeniedBody')}</p>
      </Card>
    );
  }

  const title = isMultiDay ? t('tours.multiDayTitle') : t('tours.dailyTitle');
  const subtitle = isMultiDay ? t('tours.multiDaySubtitle') : t('tours.dailySubtitle');

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> {isMultiDay ? t('tours.newMultiDayTour') : t('tours.newDailyTour')}
        </Button>
      </div>

      <Input
        placeholder={t('common.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {tours.length === 0 ? (
        <Card className="p-12 text-center">
          <TourIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground mb-2">{t('tours.noTours')}</h3>
          <p className="text-muted-foreground">{t('tours.noToursBody')}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tours.map((tour) => {
            const firstTier = tour.pricingTiers && tour.pricingTiers[0];
            const loc = isMultiDay ? `${tour.startLocation || '—'} → ${tour.endLocation || '—'}` : tour.location;
            return (
              <Card key={tour.id} className="p-6 bg-card">
                {tour.coverImage && (
                  <img
                    src={tour.coverImage}
                    alt={tour.name}
                    className="w-full h-40 object-cover rounded-md mb-3 border"
                  />
                )}
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg text-foreground truncate">{tour.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="w-3.5 h-3.5" /> <span className="truncate">{loc}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleFeaturedMutation.mutate({ id: tour.id, featured: !tour.featured })}
                      title={t('tours.featured')}
                    >
                      <Star
                        className={`w-4 h-4 ${tour.featured ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
                      />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openModal(tour)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(tour.id)}>
                      <Trash2 className="w-4 h-4 text-red-500 dark:text-red-300" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {tour.supplierName && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {tour.supplierName}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="capitalize">
                    {tour.language}
                  </Badge>
                  {!isMultiDay && (
                    <Badge variant="outline">
                      {tour.tourStyle === 'private' ? t('tours.private') : t('tours.regular')}
                    </Badge>
                  )}
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {tour.minOccupancy}–{tour.maxOccupancy}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    {tour.transportation ? <Bus className="w-3 h-3" /> : <Bus className="w-3 h-3 opacity-30" />}
                    {tour.transportation ? t('common.yes') : t('common.no')}
                  </Badge>
                </div>

                {resolveTourDescription(tour.description) && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                    {resolveTourDescription(tour.description)}
                  </p>
                )}

                {tour.startingTime && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                    <Clock className="w-3.5 h-3.5" /> {tour.startingTime}
                  </div>
                )}
                {tour.sights && tour.sights.length > 0 && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                    <TourIcon className="w-3.5 h-3.5" /> {tour.sights.join(', ')}
                  </div>
                )}
                {tour.mealTreatment && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                    <Utensils className="w-3.5 h-3.5" /> {tour.mealTreatment}
                  </div>
                )}
                {isMultiDay && tour.nights && tour.nights.length > 0 && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                    <Hotel className="w-3.5 h-3.5" /> {tour.nights.length}{' '}
                    {tour.nights.length === 1 ? 'night' : 'nights'}
                  </div>
                )}

                {isMultiDay && (
                  <div className="mt-3 pt-3 border-t text-sm space-y-1.5">
                    {(() => {
                      const departures = getDepartureDates(tour);
                      const availability = Number(tour.availability) || 0;
                      if (departures.length === 0) {
                        return <p className="text-muted-foreground">{t('tours.noDepartures')}</p>;
                      }
                      return (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 font-medium">
                              <CalendarCheck className="w-3.5 h-3.5" /> {t('tours.departure')}
                            </span>
                            <Button variant="outline" size="sm" onClick={() => openBooking(tour)} className="h-7">
                              <CalendarCheck className="w-3.5 h-3.5 mr-1" /> {t('tours.bookTour')}
                            </Button>
                          </div>
                          {departures.map((date) => {
                            const booked = bookedByDeparture[`${tour.id}|${date}`] || 0;
                            const remaining = Math.max(0, availability - booked);
                            return (
                              <div key={date} className="flex items-center justify-between text-muted-foreground">
                                <span>{date}</span>
                                <span>
                                  {t('tours.remaining')}:{' '}
                                  <span className="font-semibold text-foreground">{remaining}</span>
                                  {availability ? ` / ${availability}` : ''}
                                  {booked ? ` (${t('tours.booked')}: ${booked})` : ''}
                                </span>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                )}

                {firstTier && (
                  <div className="mt-3 pt-3 border-t text-sm">
                    <span className="text-muted-foreground">{t('tours.price')}: </span>
                    <span className="font-semibold">
                      {symbol}
                      {firstTier.price}
                      {tour.pricingTiers.length > 1 ? '+' : ''}{' '}
                      <span className="text-muted-foreground">/ {t('tours.participants')}</span>
                    </span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? isMultiDay
                  ? t('tours.editMultiDayTour')
                  : t('tours.editDailyTour')
                : isMultiDay
                  ? t('tours.createMultiDayDialog')
                  : t('tours.createDailyDialog')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>{t('tours.name')}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>{t('tours.supplier')}</Label>
                <Select
                  value={formData.supplierId || '__none__'}
                  onValueChange={(v) => {
                    const supplier = v && v !== '__none__' ? suppliers.find((s) => s.id === v) : null;
                    setFormData({
                      ...formData,
                      supplierId: supplier ? supplier.id : '',
                      supplierName: supplier ? supplier.name : '',
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('tours.selectSupplier')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('tours.noSupplier')}</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>{t('tours.description')}</Label>
                  <div className="flex flex-wrap gap-1">
                    {TOUR_DESC_LANGS.map((lng) => (
                      <button
                        key={lng}
                        type="button"
                        onClick={() => setDescLang(lng)}
                        className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                          descLang === lng
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                        }`}
                      >
                        {lng.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm"
                  value={(formData.description && formData.description[descLang]) || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      description: { ...(formData.description || {}), [descLang]: e.target.value },
                    })
                  }
                  placeholder={t('tours.descriptionPlaceholder')}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <ImageUpload
                  label={t('tours.coverImage')}
                  value={formData.coverImage}
                  onChange={(url) => setFormData({ ...formData, coverImage: url })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('tours.language')}</Label>
                <Select value={formData.language} onValueChange={(v) => setFormData({ ...formData, language: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isMultiDay ? (
                <>
                  <div className="space-y-2">
                    <Label>{t('tours.startLocation')}</Label>
                    <Input
                      value={formData.startLocation}
                      onChange={(e) => setFormData({ ...formData, startLocation: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('tours.endLocation')}</Label>
                    <Input
                      value={formData.endLocation}
                      onChange={(e) => setFormData({ ...formData, endLocation: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>{t('tours.location')}</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>{t('tours.startingTime')}</Label>
                <Input
                  type="time"
                  value={formData.startingTime}
                  onChange={(e) => setFormData({ ...formData, startingTime: e.target.value })}
                />
              </div>

              {!isMultiDay && (
                <div className="space-y-2">
                  <Label>{t('tours.tourStyle')}</Label>
                  <Select value={formData.tourStyle} onValueChange={(v) => setFormData({ ...formData, tourStyle: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">{t('tours.private')}</SelectItem>
                      <SelectItem value="regular">{t('tours.regular')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('tours.minOccupancy')}</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.minOccupancy}
                  onChange={(e) => setFormData({ ...formData, minOccupancy: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('tours.maxOccupancy')}</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.maxOccupancy}
                  onChange={(e) => setFormData({ ...formData, maxOccupancy: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('tours.sights')}</Label>
              <div className="flex gap-2">
                <Input
                  value={sightInput}
                  onChange={(e) => setSightInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSight();
                    }
                  }}
                  placeholder={t('tours.addSight')}
                />
                <Button type="button" variant="outline" onClick={addSight}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {formData.sights.map((sight, i) => (
                  <Badge key={i} variant="secondary" className="flex items-center gap-1">
                    {sight}
                    <button type="button" onClick={() => removeSight(i)} className="ml-1 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('tours.mealTreatment')}</Label>
              <Select
                value={formData.mealTreatment}
                onValueChange={(v) => setFormData({ ...formData, mealTreatment: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TREATMENTS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Bus className="w-4 h-4" />
                <Label>{t('tours.transportation')}</Label>
              </div>
              <Switch
                checked={!!formData.transportation}
                onCheckedChange={(v) => setFormData({ ...formData, transportation: v })}
              />
            </div>

            <Separator />

            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  <Label>{t('tours.featured')}</Label>
                </div>
                <Switch
                  checked={!!formData.featured}
                  onCheckedChange={(v) => setFormData({ ...formData, featured: v })}
                />
              </div>
              <p className="text-xs text-muted-foreground -mt-2">{t('tours.featuredHelp')}</p>

              <Separator />

              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                <Label>{t('tours.specialOffer')}</Label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('tours.discountPercent')}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.specialOffer?.percent ?? 0}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        specialOffer: {
                          ...(f.specialOffer || { percent: 0, startDate: '', endDate: '' }),
                          percent: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('tours.discountStart')}</Label>
                  <Input
                    type="date"
                    value={formData.specialOffer?.startDate || ''}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        specialOffer: {
                          ...(f.specialOffer || { percent: 0, startDate: '', endDate: '' }),
                          startDate: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('tours.discountEnd')}</Label>
                  <Input
                    type="date"
                    value={formData.specialOffer?.endDate || ''}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        specialOffer: {
                          ...(f.specialOffer || { percent: 0, startDate: '', endDate: '' }),
                          endDate: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('tours.specialOfferHelp')}</p>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t('tours.pricingTiers')}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addTier}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> {t('tours.addTier')}
                </Button>
              </div>
              {formData.pricingTiers.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('common.none')}</p>
              )}
              {formData.pricingTiers.map((tier, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">{t('tours.minParticipants')}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={tier.minParticipants}
                      onChange={(e) => updateTier(i, 'minParticipants', e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">{t('tours.maxParticipants')}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={tier.maxParticipants}
                      onChange={(e) => updateTier(i, 'maxParticipants', e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">{t('tours.price')}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={tier.price}
                      onChange={(e) => updateTier(i, 'price', e.target.value)}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeTier(i)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>

            {isMultiDay && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{t('tours.nights')}</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addNight}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> {t('tours.addNight')}
                    </Button>
                  </div>
                  {formData.nights.length === 0 && <p className="text-sm text-muted-foreground">{t('common.none')}</p>}
                  {formData.nights.map((night, i) => (
                    <div key={i} className="flex items-end gap-2">
                      <div className="w-16 space-y-1">
                        <Label className="text-xs">{t('tours.day')}</Label>
                        <Input value={night.day} readOnly />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">{t('tours.lodging')}</Label>
                        <Input value={night.lodging} onChange={(e) => updateNight(i, 'lodging', e.target.value)} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">{t('tours.hotelMealTreatment')}</Label>
                        <Select
                          value={night.hotelMealTreatment}
                          onValueChange={(v) => updateNight(i, 'hotelMealTreatment', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {MEAL_TREATMENTS.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeNight(i)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {isMultiDay && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('tours.durationDays')}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.durationDays}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          durationDays: Number(e.target.value) || 1,
                          dayDescriptions: syncDayDescriptions(f.dayDescriptions, e.target.value),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>{t('tours.dayByDay')}</Label>
                    {formData.dayDescriptions.map((day, i) => (
                      <div key={i} className="rounded-lg border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">
                            {t('tours.day')} {i + 1}
                          </span>
                        </div>
                        <textarea
                          className="w-full min-h-[60px] rounded-md border bg-background px-3 py-2 text-sm"
                          value={day.description}
                          onChange={(e) =>
                            setFormData((f) => ({
                              ...f,
                              dayDescriptions: f.dayDescriptions.map((d, di) =>
                                di === i ? { ...d, description: e.target.value } : d,
                              ),
                            }))
                          }
                          placeholder={t('tours.dayDescriptionPlaceholder')}
                        />
                        <ImageUpload
                          label={t('tours.dayImage')}
                          value={day.image}
                          onChange={(url) =>
                            setFormData((f) => ({
                              ...f,
                              dayDescriptions: f.dayDescriptions.map((d, di) => (di === i ? { ...d, image: url } : d)),
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {isMultiDay && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('tours.departureDate')} *</Label>
                      <Input
                        type="date"
                        required
                        value={formData.departureDate}
                        onChange={(e) => setFormData({ ...formData, departureDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('tours.availability')} *</Label>
                      <Input
                        type="number"
                        min={0}
                        required
                        value={formData.availability}
                        onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Repeat className="w-4 h-4" />
                      <Label>{t('tours.repeatWeekly')}</Label>
                    </div>
                    <Switch
                      checked={!!formData.repeatWeekly}
                      onCheckedChange={(v) => setFormData({ ...formData, repeatWeekly: v })}
                    />
                  </div>

                  {formData.repeatWeekly && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t('tours.repeatStart')}</Label>
                        <Input
                          type="date"
                          value={formData.repeatStart}
                          onChange={(e) => setFormData({ ...formData, repeatStart: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('tours.repeatEnd')}</Label>
                        <Input
                          type="date"
                          value={formData.repeatEnd}
                          onChange={(e) => setFormData({ ...formData, repeatEnd: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeModal}>
                {t('common.cancel')}
              </Button>
              <Button type="submit">{editing ? t('common.save') : t('tours.newTour')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={bookingOpen} onOpenChange={closeBooking}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('tours.bookTour')} — {bookingTour?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBookingSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>{t('tours.selectDeparture')}</Label>
              <Select
                value={bookingForm.departureDate}
                onValueChange={(v) => setBookingForm({ ...bookingForm, departureDate: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('tours.selectDeparture')} />
                </SelectTrigger>
                <SelectContent>
                  {(bookingTour ? getDepartureDates(bookingTour) : []).map((date) => {
                    const availability = Number(bookingTour?.availability) || 0;
                    const booked = bookedByDeparture[`${bookingTour?.id}|${date}`] || 0;
                    const remaining = Math.max(0, availability - booked);
                    return (
                      <SelectItem key={date} value={date}>
                        {date} ({t('tours.remaining')}: {remaining})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('tours.participants')}</Label>
              <Input
                type="number"
                min={1}
                value={bookingForm.participants}
                onChange={(e) => setBookingForm({ ...bookingForm, participants: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('tours.customerName')}</Label>
              <Input
                value={bookingForm.customerName}
                onChange={(e) => setBookingForm({ ...bookingForm, customerName: e.target.value })}
                placeholder="—"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('common.status')}</Label>
              <Select value={bookingForm.status} onValueChange={(v) => setBookingForm({ ...bookingForm, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">{t('common.confirmed')}</SelectItem>
                  <SelectItem value="pending">{t('common.pending')}</SelectItem>
                  <SelectItem value="cancelled">{t('common.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeBooking}>
                {t('common.cancel')}
              </Button>
              <Button type="submit">{t('tours.bookTour')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
