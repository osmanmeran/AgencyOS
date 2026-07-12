import { db } from '@/lib/DbContext';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DateField } from '@/components/ui/date-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SkeletonCard } from '@/components/ui/skeletons';
import { Send, AlertTriangle } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';
import { getCatalog } from '@/lib/b2bApi';
import { addToCart } from '@/lib/clientCart';
import { getActAsClientId, useActAsClientId } from '@/lib/actAsClient';
import { useMyClient } from '@/hooks/useMyClient';
import { useT } from '@/lib/i18n/I18nContext';
import { getCurrencySymbol } from '@/lib/formatters';
import { nightsBetween } from '@/lib/hotelPricing';
import { CAR_RENTAL_LOCATIONS } from '@/lib/carRentalLocations';
import CarRentalResultCard from '@/components/carRental/CarRentalResultCard';

const isCarRentalCategory = (name) => {
  const c = (name || '').toLowerCase();
  return c.includes('rent a car') || c.includes('rental') || c.includes('car rental');
};

// "Same as pick-up" is a sentinel, not a real location — keeps the drop-off
// Select single-purpose instead of a separate toggle + conditional field.
const SAME_AS_PICKUP = '__same__';

// Hands off from the portal home's hero search (see ClientPortal.jsx): a
// pickup/dropoff/pickupdate/dropoffdate query string, read once at mount.
function readInitialSearch() {
  if (typeof window === 'undefined') return { pickup: '', dropoff: '', pickupdate: '', dropoffdate: '' };
  const sp = new URLSearchParams(window.location.search);
  return {
    pickup: sp.get('pickup') || '',
    dropoff: sp.get('dropoff') || '',
    pickupdate: sp.get('pickupdate') || '',
    dropoffdate: sp.get('dropoffdate') || '',
  };
}

export default function ClientCarRentalSearch() {
  const { t } = useT();
  const navigate = useNavigate();
  const client = useMyClient();
  const actAsClientId = useActAsClientId();
  const [isStaffPreview, setIsStaffPreview] = useState(false);

  const [initialSearch] = useState(readInitialSearch);
  const [pickupLocation, setPickupLocation] = useState(initialSearch.pickup);
  const [dropoffLocation, setDropoffLocation] = useState(initialSearch.dropoff || SAME_AS_PICKUP);
  const [pickupDate, setPickupDate] = useState(initialSearch.pickupdate);
  const [dropoffDate, setDropoffDate] = useState(initialSearch.dropoffdate);

  const [selected, setSelected] = useState(/** @type {any} */ (null));
  const [insurance, setInsurance] = useState(false);

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

  const days = nightsBetween(pickupDate, dropoffDate);
  const dropoffLocationEffective = dropoffLocation === SAME_AS_PICKUP ? pickupLocation : dropoffLocation;
  const isDifferentDropoff =
    !!pickupLocation && !!dropoffLocationEffective && dropoffLocationEffective !== pickupLocation;

  // One card per rental company (supplier) at the chosen pick-up location —
  // same reasoning as the hotel results: a supplier can have several
  // matching pricing rows (different car categories), and this is a search
  // results list, not a flat price list. Cheapest per supplier wins.
  const results = useMemo(() => {
    if (!pickupLocation || days <= 0) return [];
    const candidates = catalogItems.filter(
      (item) => isCarRentalCategory(item.category_name) && (item.car_rental_locations || []).includes(pickupLocation),
    );
    const bestBySupplier = new Map();
    for (const item of candidates) {
      const key = item.supplier_id || item.supplier_name;
      const current = bestBySupplier.get(key);
      if (!current || item.unit_price < current.unit_price) bestBySupplier.set(key, item);
    }
    return [...bestBySupplier.values()].sort((a, b) => a.unit_price - b.unit_price);
  }, [catalogItems, pickupLocation, days]);

  const openConfirm = (item) => {
    setSelected(item);
    setInsurance(false);
  };

  const rentalTotal = selected ? selected.unit_price * days : 0;
  const dropOffFee = selected && isDifferentDropoff ? selected.drop_off_surcharge || 0 : 0;
  const insuranceTotal = selected && insurance ? (selected.insurance_surcharge || 0) * days : 0;
  const grandTotal = rentalTotal + dropOffFee + insuranceTotal;

  // Add the selected car rental to the client's quote cart instead of
  // submitting instantly — passenger/contact details are collected in the
  // Request-a-Quote builder before confirmation.
  const addToCartHandler = () => {
    if (!selected) return;
    const saved = addToCart({
      _key: `cart-${Date.now()}`,
      pricing_id: selected.pricing_id,
      service_name: selected.name,
      unit: selected.unit,
      quantity: 1,
      start_date: pickupDate,
      end_date: dropoffDate,
      pickup_location: pickupLocation,
      dropoff_location: dropoffLocationEffective,
      car_category: selected.car_category || undefined,
      car_rental_days: days,
      car_insurance: insurance,
    });
    if (!saved) {
      showError(t('cart.addToCartFailed'));
      return;
    }
    showSuccess(t('cart.addedToCart'));
    navigate(createPageUrl('ClientQuoteBuilder'));
  };

  if (!client || catLoading) return <SkeletonCard />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('carRentalSearch.pageTitle')}</h1>
      </div>

      <Card className="p-4 bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('carRentalSearch.pickupLocation')}</Label>
            <Select value={pickupLocation} onValueChange={setPickupLocation}>
              <SelectTrigger>
                <SelectValue placeholder={t('carRentalSearch.selectLocation')} />
              </SelectTrigger>
              <SelectContent>
                {CAR_RENTAL_LOCATIONS.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('carRentalSearch.dropoffLocation')}</Label>
            <Select value={dropoffLocation} onValueChange={setDropoffLocation}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SAME_AS_PICKUP}>{t('carRentalSearch.sameAsPickup')}</SelectItem>
                {CAR_RENTAL_LOCATIONS.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DateField
            label={t('carRentalSearch.pickupDate')}
            value={pickupDate}
            onChange={setPickupDate}
            placeholder={t('carRentalSearch.pickupDate')}
          />
          <DateField
            label={t('carRentalSearch.dropoffDate')}
            value={dropoffDate}
            onChange={setDropoffDate}
            minDate={pickupDate}
            placeholder={t('carRentalSearch.dropoffDate')}
          />
        </div>
      </Card>

      {!pickupLocation ? (
        <p className="text-muted-foreground text-center py-12">{t('carRentalSearch.pickLocation')}</p>
      ) : days <= 0 ? (
        <p className="text-muted-foreground text-center py-12">{t('carRentalSearch.pickDates')}</p>
      ) : results.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          {t('carRentalSearch.noResults', { location: pickupLocation })}
        </p>
      ) : (
        <div className="space-y-4">
          {results.map((item) => (
            <CarRentalResultCard key={item.pricing_id} item={item} days={days} onSelect={openConfirm} />
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
                  {pickupLocation} → {dropoffLocationEffective} · {pickupDate} – {dropoffDate} ·{' '}
                  {t('carRentalSearch.daysCount', { count: days })}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-muted-foreground">{t('carRentalSearch.rentalPrice')}</span>
                  <span className="font-semibold text-foreground">
                    {getCurrencySymbol(selected.currency)}
                    {rentalTotal.toFixed(2)}
                  </span>
                </div>
                {isDifferentDropoff && (
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {t('carRentalSearch.dropOffFeeNote', {
                        fee: `${getCurrencySymbol(selected.currency)}${dropOffFee.toFixed(2)}`,
                      })}
                    </span>
                  </div>
                )}
              </div>

              {selected.insurance_surcharge > 0 && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="car-insurance"
                    checked={insurance}
                    onChange={(e) => setInsurance(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="car-insurance" className="text-sm cursor-pointer">
                    {t('carRentalSearch.addInsurance', {
                      price: `${getCurrencySymbol(selected.currency)}${selected.insurance_surcharge.toFixed(2)}`,
                    })}
                  </Label>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="font-semibold text-foreground">{t('hotelSearch.grandTotal')}</span>
                <span className="text-lg font-bold text-foreground">
                  {getCurrencySymbol(selected.currency)}
                  {grandTotal.toFixed(2)}
                </span>
              </div>

              {isStaffPreview ? (
                <p className="text-center text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg py-2.5">
                  Staff preview is read-only — sign in as the client to submit a quote request.
                </p>
              ) : (
                <Button className="w-full" onClick={addToCartHandler}>
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    {t('cart.addToCart')}
                  </>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
