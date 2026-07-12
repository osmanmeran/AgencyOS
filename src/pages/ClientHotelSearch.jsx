import { db } from '@/lib/DbContext';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SkeletonCard } from '@/components/ui/skeletons';
import { Loader2, Send, ArrowRightLeft } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';
import { getCatalog, submitQuote } from '@/lib/b2bApi';
import { getActAsClientId, useActAsClientId } from '@/lib/actAsClient';
import { useMyClient } from '@/hooks/useMyClient';
import { useUpcomingTrip } from '@/hooks/useUpcomingTrip';
import { useT } from '@/lib/i18n/I18nContext';
import { getCurrencySymbol } from '@/lib/formatters';
import { getBlockingStopSale } from '@/lib/supplierStopSales';
import TripAttachChoice from '@/components/b2b/TripAttachChoice';
import {
  isLodgingCategory,
  locationOf,
  occupancyForAdults,
  resolveRoomRatesForRange,
  nightsBetween,
  unitPriceFor,
  OCCUPANCY_LABELS,
  OCCUPANCY_I18N_KEYS,
  MEAL_TREATMENT_I18N_KEYS,
} from '@/lib/hotelPricing';
import HotelSearchBar from '@/components/hotelSearch/HotelSearchBar';
import HotelResultCard from '@/components/hotelSearch/HotelResultCard';

// Same flat/per-group unit convention ClientQuoteBuilder.jsx uses — a
// transfer priced this way doesn't scale with passenger count.
const FIXED_UNITS = ['per_group', 'flat_rate'];
const isTransferCategory = (name) => (name || '').toLowerCase().includes('transfer');
const TRANSFER_TYPES = [
  'Airport Pickup',
  'Airport Drop-off',
  'Point to Point',
  'Hotel to Hotel',
  'Port Transfer',
  'City Transfer',
];

// Hands off from the portal home's hero search (see ClientPortal.jsx): a
// destination/checkin/checkout/guests query string, read once at mount.
function readInitialSearch() {
  if (typeof window === 'undefined') return { destination: '', checkin: '', checkout: '', guests: 2 };
  const sp = new URLSearchParams(window.location.search);
  return {
    destination: sp.get('destination') || '',
    checkin: sp.get('checkin') || '',
    checkout: sp.get('checkout') || '',
    guests: parseInt(sp.get('guests') || '', 10) || 2,
  };
}

export default function ClientHotelSearch() {
  const { t } = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const client = useMyClient();
  const upcomingTrip = useUpcomingTrip(client?.id);
  const actAsClientId = useActAsClientId();
  const [isStaffPreview, setIsStaffPreview] = useState(false);

  const [initialSearch] = useState(readInitialSearch);
  const [destinationQuery, setDestinationQuery] = useState(initialSearch.destination);
  const [checkIn, setCheckIn] = useState(initialSearch.checkin);
  const [checkOut, setCheckOut] = useState(initialSearch.checkout);
  const [adultsPerRoom, setAdultsPerRoom] = useState(initialSearch.guests);
  const [roomCount, setRoomCount] = useState(1);
  const [childAges, setChildAges] = useState(/** @type {string[]} */ ([]));

  const [selected, setSelected] = useState(/** @type {any} */ (null));
  const [requestTitle, setRequestTitle] = useState('');
  const [notes, setNotes] = useState('');

  const [addTransfer, setAddTransfer] = useState(false);
  const [transferPricingId, setTransferPricingId] = useState('');
  const [transferType, setTransferType] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [attachToTrip, setAttachToTrip] = useState(false);

  useEffect(() => {
    db.auth.me().then((me) => {
      setIsStaffPreview(!!getActAsClientId() && me.user_tier !== 'client');
    });
  }, [actAsClientId]);

  const { data: catalog, isLoading: catLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['b2bCatalog'],
      queryFn: getCatalog,
      enabled: !!client,
    })
  );
  const catalogItems = catalog?.items || [];
  const stopSales = catalog?.stop_sales || [];

  // Destination suggestions (and result matching) are restricted to
  // locations that actually have hotel inventory — not free text.
  const hotelLocations = useMemo(() => {
    const locations = new Set();
    for (const item of catalogItems) {
      if (isLodgingCategory(item.category_name)) locations.add(locationOf(item));
    }
    return [...locations].sort((a, b) => a.localeCompare(b));
  }, [catalogItems]);

  const matchedLocation = hotelLocations.find((loc) => loc.toLowerCase() === destinationQuery.trim().toLowerCase());
  const nights = nightsBetween(checkIn, checkOut);
  const derivedOccupancy = occupancyForAdults(adultsPerRoom);
  const payingChildrenCount = childAges.filter((age) => Number(age) >= 3).length;

  const setChildCount = (n) => {
    const count = Math.max(0, n);
    setChildAges((prev) => {
      const next = prev.slice(0, count);
      while (next.length < count) next.push('');
      return next;
    });
  };

  // Same matching rules as ClientQuoteBuilder's guided hotel picker: exact
  // occupancy tier, rate valid for the whole stay, supplier not stop-saled.
  // Collapsed to one card per hotel (supplier) — a hotel can have several
  // matching pricing rows (different meal plans, season-specific rates,
  // etc.), and showing every one of those as its own result read like a flat
  // price list instead of a hotel list. Each hotel's cheapest matching rate
  // wins; sorted lowest-first like a normal results page.
  const results = useMemo(() => {
    if (!matchedLocation || nights <= 0) return [];
    const candidates = catalogItems.filter(
      (item) =>
        isLodgingCategory(item.category_name) &&
        locationOf(item) === matchedLocation &&
        item.occupancy === derivedOccupancy,
    );
    const matched = resolveRoomRatesForRange(candidates, checkIn, checkOut);
    const available = matched.filter((item) => !getBlockingStopSale(stopSales, item.supplier_id, checkIn, checkOut));

    const bestBySupplier = new Map();
    for (const item of available) {
      const key = item.supplier_id || item.supplier_name;
      const current = bestBySupplier.get(key);
      if (!current || item.unit_price < current.unit_price) bestBySupplier.set(key, item);
    }
    return [...bestBySupplier.values()].sort((a, b) => a.unit_price - b.unit_price);
  }, [matchedLocation, nights, catalogItems, derivedOccupancy, checkIn, checkOut, stopSales]);

  // Transfer add-on offered alongside the hotel — same destination, so it
  // only ever offers transfer services actually available there.
  const transferOptions = useMemo(
    () => catalogItems.filter((item) => isTransferCategory(item.category_name) && locationOf(item) === matchedLocation),
    [catalogItems, matchedLocation],
  );
  const transferItem = transferOptions.find((item) => item.pricing_id === transferPricingId);
  const totalPax = roomCount * adultsPerRoom + payingChildrenCount;
  const transferQuantity = transferItem && FIXED_UNITS.includes(transferItem.unit) ? 1 : Math.max(1, totalPax);
  const transferUnitPrice = transferItem ? unitPriceFor(transferItem, transferQuantity) : 0;
  const transferTotal = transferItem ? transferUnitPrice * transferQuantity : 0;
  const hotelTotal = selected
    ? (selected.unit_price * roomCount + (selected.child_unit_price || 0) * payingChildrenCount) * nights
    : 0;

  const openConfirm = (item) => {
    setSelected(item);
    setRequestTitle(`${item.name} — ${locationOf(item)}`);
    setNotes('');
    setAddTransfer(false);
    setTransferPricingId('');
    setTransferType('');
    setFlightNumber('');
    setPickupLocation('');
    setDropoffLocation(item.name);
    setPickupTime('');
    setAttachToTrip(false);
  };

  const submitMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () => {
        const mealLabel = selected.meal_treatment
          ? t(MEAL_TREATMENT_I18N_KEYS[selected.meal_treatment] || '') || undefined
          : undefined;
        return submitQuote({
          title: requestTitle || `${selected.name} — ${locationOf(selected)}`,
          destination: locationOf(selected),
          destinations: [{ label: locationOf(selected) }],
          start_date: checkIn,
          end_date: checkOut,
          notes,
          trip_id: attachToTrip && upcomingTrip ? upcomingTrip.id : undefined,
          passengers: client ? [{ name: client.name, age_category: 'adult', is_contact: true }] : [],
          items: [
            {
              pricing_id: selected.pricing_id,
              quantity: Math.max(selected.min_quantity || 1, roomCount || 1),
              children_count: payingChildrenCount,
              start_date: checkIn,
              end_date: checkOut,
              room_type: OCCUPANCY_LABELS[selected.occupancy] || selected.occupancy,
              details: mealLabel,
            },
            ...(addTransfer && transferItem
              ? [
                  {
                    pricing_id: transferItem.pricing_id,
                    quantity: transferQuantity,
                    start_date: checkIn,
                    end_date: checkOut,
                    pickup_location: pickupLocation || undefined,
                    dropoff_location: dropoffLocation || undefined,
                    flight_number: flightNumber || undefined,
                    service_time: pickupTime || undefined,
                    details: transferType || undefined,
                  },
                ]
              : []),
          ],
        });
      },
      onSuccess: (quote) => {
        showSuccess(t('hotelSearch.submitSuccess'));
        queryClient.invalidateQueries({ queryKey: ['myQuotes'] });
        navigate(createPageUrl(`ClientQuoteDetails?id=${quote.id}`));
      },
      onError: (error) => showError(t('hotelSearch.submitError'), error.message),
    })
  );

  if (!client || catLoading) return <SkeletonCard />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {matchedLocation
            ? t('hotelSearch.pageTitle', { location: matchedLocation })
            : t('hotelSearch.pageTitleGeneric')}
        </h1>
      </div>

      <HotelSearchBar
        hotelLocations={hotelLocations}
        destinationQuery={destinationQuery}
        onDestinationChange={setDestinationQuery}
        checkIn={checkIn}
        onCheckInChange={setCheckIn}
        checkOut={checkOut}
        onCheckOutChange={setCheckOut}
        guests={adultsPerRoom}
        onGuestsChange={setAdultsPerRoom}
        onSearch={() => {}}
        className="border border-border"
      />

      <Card className="p-4 bg-card">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('hotelSearch.rooms')}</Label>
            <Input
              type="number"
              min={1}
              value={roomCount}
              onChange={(e) => setRoomCount(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('hotelSearch.adultsPerRoom')}</Label>
            <Input
              type="number"
              min={1}
              value={adultsPerRoom}
              onChange={(e) => setAdultsPerRoom(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <Label className="text-xs text-muted-foreground">{t('hotelSearch.children')}</Label>
            <Input
              type="number"
              min={0}
              value={childAges.length}
              onChange={(e) => setChildCount(parseInt(e.target.value) || 0)}
            />
          </div>
          {childAges.length > 0 && (
            <div className="col-span-2 sm:col-span-4 flex flex-wrap gap-3">
              {childAges.map((age, i) => (
                <div key={i} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {t('hotelSearch.childAge', { number: i + 1 })}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={17}
                    className="w-20"
                    value={age}
                    onChange={(e) => setChildAges((prev) => prev.map((a, idx) => (idx === i ? e.target.value : a)))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {!matchedLocation ? (
        <p className="text-muted-foreground text-center py-12">{t('hotelSearch.pickDestination')}</p>
      ) : nights <= 0 ? (
        <p className="text-muted-foreground text-center py-12">{t('hotelSearch.pickDates')}</p>
      ) : results.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          {t('hotelSearch.noResults', {
            occupancy: t(OCCUPANCY_I18N_KEYS[derivedOccupancy] || '') || derivedOccupancy,
            location: matchedLocation,
          })}
        </p>
      ) : (
        <div className="space-y-4">
          {results.map((item) => (
            <HotelResultCard
              key={item.pricing_id}
              item={item}
              unitPrice={item.unit_price}
              nights={nights}
              rooms={roomCount}
              childrenCount={payingChildrenCount}
              childUnitPrice={item.child_unit_price || 0}
              onSelect={openConfirm}
            />
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('hotelSearch.reviewTitle')}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <div className="font-semibold text-foreground">{selected.name}</div>
                <div className="text-muted-foreground">
                  {matchedLocation} · {checkIn} – {checkOut} · {t('common.daysCount', { count: nights })}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-muted-foreground">{t('hotelSearch.hotelPrice')}</span>
                  <span className="font-semibold text-foreground">
                    {getCurrencySymbol(selected.currency)}
                    {hotelTotal.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('hotelSearch.requestTitleLabel')}</Label>
                <Input value={requestTitle} onChange={(e) => setRequestTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('hotelSearch.notesLabel')}</Label>
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('hotelSearch.notesPlaceholder')}
                />
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                    {t('hotelSearch.addTransferLabel')}
                  </Label>
                  <Switch checked={addTransfer} onCheckedChange={setAddTransfer} />
                </div>
                {addTransfer &&
                  (transferOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t('hotelSearch.noTransferAvailable', { location: matchedLocation })}
                    </p>
                  ) : (
                    <div className="space-y-3 p-3 bg-muted rounded-lg">
                      <Select value={transferPricingId} onValueChange={setTransferPricingId}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('hotelSearch.selectTransfer')} />
                        </SelectTrigger>
                        <SelectContent>
                          {transferOptions.map((opt) => (
                            <SelectItem key={opt.pricing_id} value={opt.pricing_id}>
                              {opt.name} — {getCurrencySymbol(opt.currency)}
                              {opt.unit_price.toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {transferItem && (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{t('hotelSearch.transferPrice')}</span>
                            <span className="font-semibold text-foreground">
                              {getCurrencySymbol(transferItem.currency)}
                              {transferTotal.toFixed(2)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder={t('hotelSearch.pickupLocation')}
                              value={pickupLocation}
                              onChange={(e) => setPickupLocation(e.target.value)}
                            />
                            <Input
                              placeholder={t('hotelSearch.dropoffLocation')}
                              value={dropoffLocation}
                              onChange={(e) => setDropoffLocation(e.target.value)}
                            />
                            <Select value={transferType} onValueChange={setTransferType}>
                              <SelectTrigger>
                                <SelectValue placeholder={t('hotelSearch.transferTypePlaceholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                {TRANSFER_TYPES.map((tt) => (
                                  <SelectItem key={tt} value={tt}>
                                    {tt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex gap-2">
                              <Input
                                placeholder={t('hotelSearch.flightNumber')}
                                value={flightNumber}
                                onChange={(e) => setFlightNumber(e.target.value)}
                              />
                              <Input
                                type="time"
                                className="w-28 shrink-0"
                                value={pickupTime}
                                onChange={(e) => setPickupTime(e.target.value)}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="font-semibold text-foreground">{t('hotelSearch.grandTotal')}</span>
                <span className="text-lg font-bold text-foreground">
                  {getCurrencySymbol(selected.currency)}
                  {(hotelTotal + (addTransfer ? transferTotal : 0)).toFixed(2)}
                </span>
              </div>

              <TripAttachChoice trip={upcomingTrip} attach={attachToTrip} onChange={setAttachToTrip} />

              {isStaffPreview ? (
                <p className="text-center text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg py-2.5">
                  Staff preview is read-only — sign in as the client to submit a quote request.
                </p>
              ) : (
                <Button className="w-full" disabled={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('hotelSearch.submitting')}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {t('hotelSearch.submitRequestButton')}
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
