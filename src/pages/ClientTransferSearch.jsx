import { db } from '@/lib/DbContext';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateField } from '@/components/ui/date-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SkeletonCard } from '@/components/ui/skeletons';
import { Send, MapPin, Users } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';
import { getCatalog } from '@/lib/b2bApi';
import { addToCart } from '@/lib/clientCart';
import { getActAsClientId, useActAsClientId } from '@/lib/actAsClient';
import { useMyClient } from '@/hooks/useMyClient';
import { useT } from '@/lib/i18n/I18nContext';
import { getCurrencySymbol } from '@/lib/formatters';
import { unitPriceFor } from '@/lib/hotelPricing';
import { getBlockingStopSale } from '@/lib/supplierStopSales';
import { AIRPORT_LOCATIONS } from '@/lib/airportLocations';
import TransferResultCard from '@/components/transfer/TransferResultCard';

const isTransferCategory = (name) => (name || '').toLowerCase().includes('transfer');
const FIXED_UNITS = ['per_group', 'flat_rate'];
const TRANSFER_TYPES = [
  'Airport Pickup',
  'Airport Drop-off',
  'Point to Point',
  'Hotel to Hotel',
  'Port Transfer',
  'City Transfer',
];

// Hands off from the portal home's hero search (see ClientPortal.jsx): a
// from/to/passengers query string, read once at mount.
function readInitialSearch() {
  if (typeof window === 'undefined') return { from: '', to: '', passengers: 2 };
  const sp = new URLSearchParams(window.location.search);
  return {
    from: sp.get('from') || '',
    to: sp.get('to') || '',
    passengers: parseInt(sp.get('passengers') || '', 10) || 2,
  };
}

export default function ClientTransferSearch() {
  const { t } = useT();
  const navigate = useNavigate();
  const client = useMyClient();
  const actAsClientId = useActAsClientId();
  const [isStaffPreview, setIsStaffPreview] = useState(false);

  const [initialSearch] = useState(readInitialSearch);
  const [fromLocation, setFromLocation] = useState(initialSearch.from);
  const [toLocation, setToLocation] = useState(initialSearch.to);
  const [serviceDate, setServiceDate] = useState('');
  const [serviceTime, setServiceTime] = useState('');
  const [passengers, setPassengers] = useState(initialSearch.passengers);

  const [selected, setSelected] = useState(/** @type {any} */ (null));
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [transferType, setTransferType] = useState('');
  const [flightNumber, setFlightNumber] = useState('');

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

  // Matching is purely by route (start/end airport) and occupancy — not by
  // supplier, so every matching price row is shown regardless of which
  // supplier owns it (no best-per-supplier grouping/dedup).
  const results = useMemo(() => {
    if (!fromLocation || !toLocation) return [];
    const candidates = catalogItems.filter(
      (item) =>
        isTransferCategory(item.category_name) &&
        item.route_from === fromLocation &&
        item.route_to === toLocation &&
        (item.max_passengers == null || item.max_passengers >= passengers),
    );
    // Stop-sale check only makes sense once a date is picked; browsing
    // available services beforehand doesn't need one.
    const available = serviceDate
      ? candidates.filter((item) => !getBlockingStopSale(stopSales, item.supplier_id, serviceDate, serviceDate))
      : candidates;
    return [...available].sort((a, b) => a.unit_price - b.unit_price);
  }, [catalogItems, fromLocation, toLocation, passengers, serviceDate, stopSales]);

  const openConfirm = (item) => {
    setSelected(item);
    setPickupLocation(fromLocation);
    setDropoffLocation(toLocation);
    setTransferType('');
    setFlightNumber('');
  };

  const quantity = selected ? (FIXED_UNITS.includes(selected.unit) ? 1 : Math.max(1, passengers)) : 1;
  const total = selected ? unitPriceFor(selected, quantity) * quantity : 0;

  // Add the selected transfer to the client's quote cart instead of submitting
  // instantly — passenger/contact details are collected in the Request-a-Quote
  // builder before confirmation.
  const addToCartHandler = () => {
    if (!selected) return;
    const saved = addToCart({
      _key: `cart-${Date.now()}`,
      pricing_id: selected.pricing_id,
      service_name: selected.name,
      unit: selected.unit,
      quantity,
      start_date: serviceDate,
      end_date: serviceDate,
      pickup_location: pickupLocation || undefined,
      dropoff_location: dropoffLocation || undefined,
      flight_number: flightNumber || undefined,
      service_time: serviceTime || undefined,
      details: transferType || undefined,
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
        <h1 className="text-3xl font-bold text-foreground">{t('transferSearch.pageTitle')}</h1>
      </div>

      <Card className="p-4 bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {t('transferSearch.fromLabel')}
            </Label>
            <Select value={fromLocation} onValueChange={setFromLocation}>
              <SelectTrigger>
                <SelectValue placeholder={t('transferSearch.fromPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {AIRPORT_LOCATIONS.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {t('transferSearch.toLabel')}
            </Label>
            <Select value={toLocation} onValueChange={setToLocation}>
              <SelectTrigger>
                <SelectValue placeholder={t('transferSearch.toPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {AIRPORT_LOCATIONS.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DateField
            label={t('transferSearch.serviceDate')}
            value={serviceDate}
            onChange={setServiceDate}
            placeholder={t('transferSearch.serviceDate')}
          />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> {t('transferSearch.passengers')}
            </Label>
            <Input
              type="number"
              min={1}
              value={passengers}
              onChange={(e) => setPassengers(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
        </div>
      </Card>

      {!fromLocation || !toLocation ? (
        <p className="text-muted-foreground text-center py-12">{t('transferSearch.pickRoute')}</p>
      ) : results.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          {t('transferSearch.noResults', { from: fromLocation, to: toLocation })}
        </p>
      ) : (
        <div className="space-y-4">
          {results.map((item) => (
            <TransferResultCard key={item.pricing_id} item={item} passengers={passengers} onSelect={openConfirm} />
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
                  {fromLocation} → {toLocation} · {serviceDate} {serviceTime}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-muted-foreground">{t('transferSearch.total')}</span>
                  <span className="font-semibold text-foreground">
                    {getCurrencySymbol(selected.currency)}
                    {total.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('transferSearch.serviceTime')}</Label>
                  <Input type="time" value={serviceTime} onChange={(e) => setServiceTime(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('transferSearch.pickupLocation')}</Label>
                  <Input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('transferSearch.dropoffLocation')}</Label>
                  <Input value={dropoffLocation} onChange={(e) => setDropoffLocation(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('transferSearch.flightNumber')}</Label>
                  <Input value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Select value={transferType} onValueChange={setTransferType}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('transferSearch.transferTypePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSFER_TYPES.map((tt) => (
                        <SelectItem key={tt} value={tt}>
                          {tt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
