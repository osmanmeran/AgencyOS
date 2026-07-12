import { db } from '@/lib/DbContext';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SkeletonCard } from '@/components/ui/skeletons';
import { Loader2, Send } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';
import { getCatalog, submitQuote } from '@/lib/b2bApi';
import { getActAsClientId, useActAsClientId } from '@/lib/actAsClient';
import { useMyClient } from '@/hooks/useMyClient';
import { useT } from '@/lib/i18n/I18nContext';
import { getBlockingStopSale } from '@/lib/supplierStopSales';
import {
  isLodgingCategory,
  locationOf,
  occupancyForAdults,
  resolveRoomRatesForRange,
  nightsBetween,
  OCCUPANCY_LABELS,
  OCCUPANCY_I18N_KEYS,
  MEAL_TREATMENT_I18N_KEYS,
} from '@/lib/hotelPricing';
import HotelSearchBar from '@/components/hotelSearch/HotelSearchBar';
import HotelResultCard from '@/components/hotelSearch/HotelResultCard';

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

  const openConfirm = (item) => {
    setSelected(item);
    setRequestTitle(`${item.name} — ${locationOf(item)}`);
    setNotes('');
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
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div className="font-semibold text-foreground">{selected.name}</div>
                <div className="text-muted-foreground">
                  {matchedLocation} · {checkIn} – {checkOut} · {t('common.daysCount', { count: nights })}
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
