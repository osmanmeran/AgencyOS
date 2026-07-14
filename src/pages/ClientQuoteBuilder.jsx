import { db } from '@/lib/DbContext';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { SkeletonCard } from '@/components/ui/skeletons';
import {
  Plus,
  Trash2,
  Users,
  Building,
  Send,
  Loader2,
  MapPin,
  ArrowRightLeft,
  CalendarOff,
  AlertTriangle,
} from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';
import { getCatalog, submitQuote } from '@/lib/b2bApi';
import { getCart, clearCart } from '@/lib/clientCart';
import { useT } from '@/lib/i18n/I18nContext';
import { getActAsClientId, useActAsClientId } from '@/lib/actAsClient';
import LocationSearch from '@/components/services/LocationSearch';
import { getBlockingStopSale } from '@/lib/supplierStopSales';
import { tourStartingPrice, activeDiscount, tourPriceForPax } from '@/lib/tourPricing';
import { nightsBetween, unitPriceFor } from '@/lib/hotelPricing';
import PaxRow from '@/components/quote-builder/PaxRow';
import TourPickerDialog from '@/components/quote-builder/TourPickerDialog';
import ServiceLineCard from '@/components/quote-builder/ServiceLineCard';
import {
  sym,
  isCarRentalCategory,
  loadQuoteDraft,
  saveQuoteDraft,
  readHeroSearchParams,
  rid,
  newPassenger,
  newRoom,
  newDestination,
  newLine,
  lineTotal,
} from '@/components/quote-builder/helpers';

export default function ClientQuoteBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useT();

  const [client, setClient] = useState(/** @type {any} */ (null));
  const [clientLoaded, setClientLoaded] = useState(false);
  const [isStaffPreview, setIsStaffPreview] = useState(false);
  // Read once at mount: the portal home's hero search hands off here via
  // ?category=&destination=&checkin=&checkout=&guests= (see ClientPortal.jsx).
  const [heroSearch] = useState(() => readHeroSearchParams());
  const [trip, setTrip] = useState(() => ({
    title: '',
    start_date: heroSearch?.checkin || '',
    end_date: heroSearch?.checkout || '',
    notes: '',
  }));
  const [destinations, setDestinations] = useState(() =>
    heroSearch?.destination ? [{ ...newDestination(), label: heroSearch.destination }] : [newDestination()],
  );
  const [rooms, setRooms] = useState(() => [newRoom()]);
  const [lines, setLines] = useState(() => [newLine()]);
  // Compulsory contact details — the client must provide a contact phone (and
  // name) before the cart can be submitted for confirmation.
  const [contactPassenger, setContactPassenger] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const cartDrainedRef = useRef(false);
  const actAsClientId = useActAsClientId();

  useEffect(() => {
    db.auth
      .me()
      .then(async (me) => {
        let resolved = null;
        // Staff previewing the portal "as" a client (via "View portal as
        // client" on a CRM record) have no client_id of their own — resolve
        // the chosen client instead, same as ClientPortal does. Submitting is
        // still blocked server-side for staff; see isStaffPreview below.
        const asClientId = getActAsClientId();
        if (asClientId && me.user_tier !== 'client') {
          resolved = await db.entities.Client.get(asClientId).catch(() => null);
          setIsStaffPreview(true);
        } else {
          setIsStaffPreview(false);
          if (me.client_id) resolved = await db.entities.Client.get(me.client_id).catch(() => null);
          if (!resolved && me.email) {
            const list = await db.entities.Client.filter({ email: me.email });
            resolved = list[0] || null;
          }
        }
        setClient(resolved);
        setClientLoaded(true);
      })
      .catch(() => setClientLoaded(true));
  }, [actAsClientId]);

  // Restore any saved draft, then drain services the client parked in the
  // cart from the Hotel / Transfer / Car rental searches or the tour catalog.
  // A hotel carries a rooms/passengers snapshot so its rooming & occupancy
  // seed the cart.
  useEffect(() => {
    if (!clientLoaded || cartDrainedRef.current) return;
    cartDrainedRef.current = true;
    const draft = loadQuoteDraft();
    const draftHasRooms = Array.isArray(draft?.rooms) && draft.rooms.length > 0;
    if (draft) {
      if (Array.isArray(draft.lines) && draft.lines.length) setLines(draft.lines);
      if (draftHasRooms) setRooms(draft.rooms);
      if (draft.contactPassenger) setContactPassenger(draft.contactPassenger);
      if (draft.contactPhone) setContactPhone(draft.contactPhone);
    } else if (!contactPassenger) {
      setContactPassenger(client?.name || '');
    }
    const cart = getCart();
    if (cart.length) {
      const drainedLines = cart.map((it) => ({ ...newLine(), ...it, _key: it._key || rid('line') }));
      setLines((prev) => {
        const base = prev.filter((l) => l.pricing_id || l.tour_id);
        const merged = [...base, ...drainedLines];
        return merged.length ? merged : [newLine()];
      });
      // Only seed rooms from the newly-added cart item when there isn't
      // already a restored draft with rooms — a client who already filled in
      // passenger names for an earlier hotel shouldn't have them silently
      // wiped by a blank seed from a second hotel added afterward.
      const seeded = cart.find((it) => Array.isArray(it.seedRooms) && it.seedRooms.length);
      if (seeded && !draftHasRooms) setRooms(seeded.seedRooms);
      clearCart();
    }
    if (!contactPhone) setContactPhone(client?.phone || client?.mobile || '');
  }, [clientLoaded, client, contactPassenger, contactPhone]);

  // Persist the in-progress cart so navigation between pages doesn't lose it.
  useEffect(() => {
    if (!clientLoaded) return;
    saveQuoteDraft({ lines, rooms, contactPassenger, contactPhone });
  }, [clientLoaded, lines, rooms, contactPassenger, contactPhone]);

  const currency = client?.preferred_currency || 'USD';

  const { data: catalog, isLoading: catLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['b2bCatalog'],
      queryFn: getCatalog,
      enabled: !!client,
    })
  );

  // All available services, filterable by category/location/supplier in the
  // picker. unit_price already has the client's markup applied and is
  // already converted to their preferred currency (both computed server-side).
  const services = catalog?.items || [];
  const servicesById = useMemo(() => new Map(services.map((s) => [s.pricing_id, s])), [services]);
  const stopSales = catalog?.stop_sales || [];

  // Guided-tour catalog (the curated GuidedTour entity), client-portal readable.
  const { data: toursData } = /** @type {any} */ (
    useQuery({
      queryKey: ['builderTours'],
      queryFn: () => db.entities.GuidedTour.list(),
      enabled: !!client,
    })
  );
  const tours = toursData || [];
  const [tourPickerOpen, setTourPickerOpen] = useState(false);

  // Tours keep their own currency (set by staff per-tour) which can differ
  // from the client's preferred display currency that every other line in
  // this builder is already shown/summed in (services are converted
  // server-side — see the /catalog route). Convert here too, the same way
  // the server converts tour prices at submit time (b2b.js convertItemsToCurrency),
  // so the on-page total never silently adds mismatched currencies together.
  const addTour = async (/** @type {any} */ tour) => {
    // Close the picker immediately so a slow exchange-rate fetch below can't
    // leave the dialog open and clickable, letting a double-click (or a
    // second tour pick) fire a second concurrent add before this one lands.
    setTourPickerOpen(false);
    const totalPax = rooms.reduce((s, r) => s + (r.passengers?.length || 0), 0);
    const start = tourPriceForPax(tour, totalPax) ?? tourStartingPrice(tour);
    const disc = activeDiscount(tour);
    const tourCurrency = tour.currency || 'USD';
    let rate = 1;
    let converted = tourCurrency === currency;
    if (!converted) {
      try {
        rate = (await db.integrations.Core.GetExchangeRate(tourCurrency, currency))?.rate || 1;
        converted = true;
      } catch {
        converted = false;
      }
    }
    const scale = (v) => (v == null ? v : Math.round(v * rate * 100) / 100);
    const original = start != null ? start : 0;
    const display = disc ? disc.discounted : original;
    const line = {
      ...newLine(),
      _key: rid('line'),
      tour_id: tour.id,
      service_name: tour.name,
      tourMode: tour.mode || '',
      unit: 'per_person',
      tour_original_price: converted ? scale(original) : original,
      tour_display_price: converted ? scale(display) : display,
      tour_display_currency: converted ? currency : tourCurrency,
      tour_discount_percent: disc ? disc.percent : 0,
    };
    setLines((prev) => (prev.length === 1 && !prev[0].pricing_id && !prev[0].tour_id ? [line] : [...prev, line]));
  };

  // Destinations — one or more stops, each independently geocoded.
  const addDestination = () => setDestinations((prev) => [...prev, newDestination()]);
  const removeDestination = (id) =>
    setDestinations((prev) => (prev.length <= 1 ? prev : prev.filter((d) => d.id !== id)));
  const updateDestination = (id, updated) =>
    setDestinations((prev) => prev.map((d) => (d.id === id ? { ...d, ...updated } : d)));

  // Rooms & passengers
  const setRoomOccupancy = (roomId, count) => {
    const typeMap = { 1: 'single', 2: 'double', 3: 'triple', 4: 'quad' };
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== roomId) return r;
        const cur = r.passengers;
        let passengers;
        if (count > cur.length)
          passengers = [...cur, ...Array.from({ length: count - cur.length }, () => newPassenger())];
        else if (count < cur.length) passengers = cur.slice(0, count);
        else passengers = cur;
        return { ...r, type: typeMap[count] || 'double', passengers };
      }),
    );
  };
  const addRoom = () => setRooms((prev) => [...prev, newRoom()]);
  const removeRoom = (roomId) => setRooms((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== roomId)));
  const updatePax = (roomId, paxId, updated) =>
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId ? { ...r, passengers: r.passengers.map((p) => (p.id === paxId ? updated : p)) } : r,
      ),
    );
  const setContact = (roomId, paxId) =>
    setRooms((prev) =>
      prev.map((r) => ({
        ...r,
        passengers: r.passengers.map((p) => ({ ...p, is_contact: r.id === roomId && p.id === paxId })),
      })),
    );

  const allPassengers = rooms.flatMap((r) => r.passengers.map((p) => ({ ...p, room_id: r.id, room_type: r.type })));

  // Lines
  const addLine = () => setLines((prev) => [...prev, newLine()]);
  const updateLine = (key, updated) => setLines((prev) => prev.map((l) => (l._key === key ? updated : l)));
  const removeLine = (key) => setLines((prev) => (prev.length <= 1 ? [newLine()] : prev.filter((l) => l._key !== key)));

  const validLines = lines.filter((l) => l.pricing_id || l.tour_id);
  const blockedLines = validLines.filter((l) => {
    if (l.tour_id) return false;
    const svc = servicesById.get(l.pricing_id);
    const supplierId = svc?.supplier_id || l.supplier_id;
    const start = l.start_date || l.service_date;
    const end = l.end_date || l.service_date;
    return !!getBlockingStopSale(stopSales, supplierId, start, end);
  });
  // Tour lines price per paying participant (infants excluded), so this must
  // be computed before `total` below, which reads it for tour_id lines.
  const payingParticipants = allPassengers.filter((p) => p.age_category !== 'infant').length;
  const total = useMemo(
    () =>
      validLines.reduce((sum, l) => {
        if (l.tour_id) {
          const paying = payingParticipants || 1;
          return sum + (Number(l.tour_display_price) || 0) * paying;
        }
        const svc = servicesById.get(l.pricing_id);
        const unitPrice = unitPriceFor(svc, l.quantity);
        const carRentalDays = isCarRentalCategory(svc?.category_name) ? nightsBetween(l.start_date, l.end_date) : null;
        return (
          sum +
          lineTotal(
            l,
            unitPrice,
            {
              insuranceSurcharge: svc?.insurance_surcharge || 0,
              childUnitPrice: svc?.child_unit_price || 0,
            },
            carRentalDays,
          )
        );
      }, 0),
    [validLines, servicesById, allPassengers],
  );

  // Passenger / contact validation — the cart cannot be submitted for
  // confirmation until these are satisfied.
  const namedPassengers = allPassengers.filter((p) => (p.name || '').trim()).length;
  const contactPhoneValid = contactPhone.trim().length > 0;
  const contactPassengerValid = contactPassenger.trim().length > 0;
  const passengerValid = namedPassengers > 0;
  const canSubmit =
    validLines.length > 0 && blockedLines.length === 0 && contactPhoneValid && contactPassengerValid && passengerValid;

  const namedDestinations = destinations.filter((d) => d.label);

  const submitMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () =>
        submitQuote({
          title: trip.title || 'Quote request',
          destination: namedDestinations.map((d) => d.label).join(' & '),
          destinations: namedDestinations.map((d) => ({ label: d.label, lat: d.lat, lon: d.lon })),
          start_date: trip.start_date,
          end_date: trip.end_date,
          notes: trip.notes,
          passengers: allPassengers,
          contact_passenger: contactPassenger.trim(),
          contact_phone: contactPhone.trim(),
          items: validLines.map((l) => {
            if (l.tour_id) {
              const paying = allPassengers.filter((p) => p.age_category !== 'infant');
              return {
                tour_id: l.tour_id,
                tour_name: l.service_name,
                tour_mode: l.tourMode || '',
                service_date: l.service_date || undefined,
                adults: paying.filter((p) => p.age_category === 'adult').length,
                children: paying.filter((p) => p.age_category === 'children').length,
                infants: allPassengers.filter((p) => p.age_category === 'infant').length,
                details: l.details || undefined,
              };
            }
            return {
              pricing_id: l.pricing_id,
              quantity: l.quantity || 1,
              children_count: l.children_count || 0,
              start_date: l.start_date || l.service_date || undefined,
              end_date: l.end_date || l.service_date || undefined,
              room_type: l.room_type || undefined,
              pickup_location: l.pickup_location || undefined,
              dropoff_location: l.dropoff_location || undefined,
              flight_number: l.flight_number || undefined,
              service_time: l.service_time || undefined,
              car_insurance: l.car_insurance || undefined,
              details:
                [l.hotel_treatment, l.transfer_type, l.duration, l.details].filter(Boolean).join(' · ') || undefined,
            };
          }),
        }),
      onSuccess: (quote) => {
        showSuccess('Quote request submitted');
        saveQuoteDraft(null);
        clearCart();
        queryClient.invalidateQueries({ queryKey: ['myQuotes'] });
        navigate(createPageUrl(`ClientQuoteDetails?id=${quote.id}`));
      },
      onError: (error) => showError('Failed to submit quote request', error.message),
    })
  );

  if (!clientLoaded || (client && catLoading)) return <SkeletonCard />;

  if (!client) {
    return (
      <Card className="max-w-md mx-auto p-8 text-center mt-10">
        <h2 className="text-xl font-bold text-foreground mb-2">Account not ready</h2>
        <p className="text-muted-foreground">Your client account is being set up. Please contact your travel agent.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Request a Quote</h1>
        <p className="text-muted-foreground mt-1 flex items-center gap-2">
          Build your trip and send it to us for pricing
          <span className="inline-flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
            <ArrowRightLeft className="w-3 h-3" /> Prices in {currency}
          </span>
        </p>
      </div>

      {/* Trip details */}
      <Card className="p-6 bg-card shadow-md">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-300" />
          Trip Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Trip title</Label>
            <Input
              value={trip.title}
              onChange={(e) => setTrip({ ...trip, title: e.target.value })}
              placeholder="e.g. Summer in Cappadocia"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Destination{destinations.length > 1 ? 's' : ''}</Label>
            <div className="space-y-2">
              {destinations.map((dest, i) => (
                <div key={dest.id} className="flex gap-2">
                  <div className="flex-1">
                    <LocationSearch
                      value={dest.label}
                      onChange={(v) => updateDestination(dest.id, { label: v, lat: null, lon: null })}
                      onSelect={(item) =>
                        updateDestination(dest.id, {
                          label: item.label,
                          lat: item.lat != null ? Number(item.lat) : null,
                          lon: item.lon != null ? Number(item.lon) : null,
                        })
                      }
                      placeholder={i === 0 ? 'e.g. Istanbul' : 'e.g. Cappadocia'}
                      showCurrentLocationButton={false}
                    />
                  </div>
                  {destinations.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 shrink-0"
                      onClick={() => removeDestination(dest.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={addDestination}>
                <Plus className="w-4 h-4 mr-1" />
                Add destination
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Start date</Label>
            <Input
              type="date"
              value={trip.start_date}
              onChange={(e) => setTrip({ ...trip, start_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>End date</Label>
            <Input type="date" value={trip.end_date} onChange={(e) => setTrip({ ...trip, end_date: e.target.value })} />
          </div>
        </div>
      </Card>

      {/* Rooms & passengers */}
      <Card className="p-6 bg-card shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-300" />
            Rooms & Passengers
          </h2>
          <Button type="button" size="sm" variant="outline" onClick={addRoom}>
            <Plus className="w-4 h-4 mr-1" />
            Add room
          </Button>
        </div>
        <div className="space-y-4">
          {rooms.map((room, ri) => (
            <div key={room.id} className="border border-border rounded-lg bg-muted overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground text-sm">Room {ri + 1}</span>
                  <Select
                    value={String(room.passengers.length)}
                    onValueChange={(v) => setRoomOccupancy(room.id, parseInt(v))}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} Person{n > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-red-500 dark:text-red-300 hover:text-red-700 dark:hover:text-red-300"
                  onClick={() => removeRoom(room.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="p-3 space-y-2">
                {room.passengers.map((pax) => (
                  <PaxRow
                    key={pax.id}
                    pax={pax}
                    onChange={(u) => updatePax(room.id, pax.id, u)}
                    onSetContact={() => setContact(room.id, pax.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <Separator className="my-4" />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{t('quoteBuilder.contactDetails')}</h3>
            <span className="text-xs text-red-600 dark:text-red-400">* {t('quoteBuilder.required')}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('quoteBuilder.contactHelp', {
              count: allPassengers.length,
              rooms: rooms.length,
            })}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('quoteBuilder.contactPassenger')}</Label>
              <Input
                value={contactPassenger}
                onChange={(e) => setContactPassenger(e.target.value)}
                placeholder={t('quoteBuilder.contactPassengerPlaceholder')}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t('quoteBuilder.contactPhone')} <span className="text-red-600">*</span>
              </Label>
              <Input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder={t('quoteBuilder.contactPhonePlaceholder')}
                className={!contactPhoneValid ? 'border-red-300 dark:border-red-800' : ''}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Services */}
      <Card className="p-6 bg-card shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-600 dark:text-blue-300" />
            Services
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={addLine} disabled={services.length === 0}>
              <Plus className="w-4 h-4 mr-1" />
              Add service
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setTourPickerOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add tour
            </Button>
          </div>
        </div>
        <TourPickerDialog open={tourPickerOpen} onOpenChange={setTourPickerOpen} tours={tours} onSelect={addTour} />
        {services.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">
            No services are available in your portal yet. Please contact your travel agent.
          </p>
        ) : (
          <div className="space-y-4">
            {lines.map((line, idx) => (
              <ServiceLineCard
                key={line._key}
                line={line}
                services={services}
                servicesById={servicesById}
                currency={currency}
                stopSales={stopSales}
                onChange={(u) => updateLine(line._key, u)}
                onRemove={() => removeLine(line._key)}
                autoOpenPicker={idx === 0 && !!heroSearch}
                initialPickerValues={idx === 0 ? heroSearch : undefined}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Notes + summary */}
      <Card className="p-6 bg-card shadow-md">
        <div className="space-y-2 mb-4">
          <Label>Notes (optional)</Label>
          <Textarea
            rows={3}
            value={trip.notes}
            onChange={(e) => setTrip({ ...trip, notes: e.target.value })}
            placeholder="Anything else we should know..."
          />
        </div>
        <Separator className="mb-4" />
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-bold text-foreground">Estimated total</span>
          <span className="text-2xl font-bold text-green-700 dark:text-green-300">
            {sym(currency)}
            {total.toFixed(2)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          This is an estimate in {currency}. Your final quote is confirmed by our team after review.
        </p>
        {blockedLines.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg py-2 px-3 mb-3">
            <CalendarOff className="w-3.5 h-3.5 flex-shrink-0" />
            {blockedLines.length} service{blockedLines.length > 1 ? 's are' : ' is'} unavailable for the dates selected
            — fix them above before submitting.
          </p>
        )}
        {!contactPhoneValid && (
          <p className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg py-2 px-3 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {t('quoteBuilder.contactPhoneRequired')}
          </p>
        )}
        {contactPhoneValid && !passengerValid && (
          <p className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg py-2 px-3 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {t('quoteBuilder.passengerNameRequired')}
          </p>
        )}
        {isStaffPreview ? (
          <p className="text-center text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg py-2.5">
            Staff preview is read-only — sign in as the client to submit a quote request.
          </p>
        ) : (
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={!canSubmit || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Quote Request
              </>
            )}
          </Button>
        )}
      </Card>
    </div>
  );
}
