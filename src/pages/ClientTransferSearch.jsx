import { db } from '@/lib/DbContext';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateField } from '@/components/ui/date-field';
import { LocationCombobox } from '@/components/ui/location-combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SkeletonCard } from '@/components/ui/skeletons';
import { Loader2, Send, MapPin, Users } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';
import { getCatalog, submitQuote } from '@/lib/b2bApi';
import { getActAsClientId, useActAsClientId } from '@/lib/actAsClient';
import { useMyClient } from '@/hooks/useMyClient';
import { useUpcomingTrip } from '@/hooks/useUpcomingTrip';
import { useT } from '@/lib/i18n/I18nContext';
import { getCurrencySymbol } from '@/lib/formatters';
import { locationOf, unitPriceFor } from '@/lib/hotelPricing';
import { getBlockingStopSale } from '@/lib/supplierStopSales';
import TransferResultCard from '@/components/transfer/TransferResultCard';
import TripAttachChoice from '@/components/b2b/TripAttachChoice';

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

export default function ClientTransferSearch() {
  const { t } = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const client = useMyClient();
  const upcomingTrip = useUpcomingTrip(client?.id);
  const actAsClientId = useActAsClientId();
  const [isStaffPreview, setIsStaffPreview] = useState(false);

  const [destinationQuery, setDestinationQuery] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [serviceTime, setServiceTime] = useState('');
  const [passengers, setPassengers] = useState(2);

  const [selected, setSelected] = useState(/** @type {any} */ (null));
  const [requestTitle, setRequestTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [transferType, setTransferType] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
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

  const transferLocations = useMemo(() => {
    const locations = new Set();
    for (const item of catalogItems) {
      if (isTransferCategory(item.category_name)) locations.add(locationOf(item));
    }
    return [...locations].sort((a, b) => a.localeCompare(b));
  }, [catalogItems]);

  const matchedLocation = transferLocations.find((loc) => loc.toLowerCase() === destinationQuery.trim().toLowerCase());

  // One card per transfer company (supplier) at the chosen destination —
  // same reasoning as hotels/car rental results: a supplier can have several
  // matching pricing rows, and this is a search results list, not a flat
  // price list. Cheapest per supplier wins.
  const results = useMemo(() => {
    if (!matchedLocation) return [];
    const candidates = catalogItems.filter(
      (item) => isTransferCategory(item.category_name) && locationOf(item) === matchedLocation,
    );
    // Stop-sale check only makes sense once a date is picked; browsing
    // available services beforehand doesn't need one.
    const available = serviceDate
      ? candidates.filter((item) => !getBlockingStopSale(stopSales, item.supplier_id, serviceDate, serviceDate))
      : candidates;
    const bestBySupplier = new Map();
    for (const item of available) {
      const key = item.supplier_id || item.supplier_name;
      const current = bestBySupplier.get(key);
      if (!current || item.unit_price < current.unit_price) bestBySupplier.set(key, item);
    }
    return [...bestBySupplier.values()].sort((a, b) => a.unit_price - b.unit_price);
  }, [catalogItems, matchedLocation, serviceDate, stopSales]);

  const openConfirm = (item) => {
    setSelected(item);
    setRequestTitle(`${item.name} — ${matchedLocation}`);
    setNotes('');
    setPickupLocation('');
    setDropoffLocation('');
    setTransferType('');
    setFlightNumber('');
    setAttachToTrip(false);
  };

  const quantity = selected ? (FIXED_UNITS.includes(selected.unit) ? 1 : Math.max(1, passengers)) : 1;
  const total = selected ? unitPriceFor(selected, quantity) * quantity : 0;

  const submitMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () =>
        submitQuote({
          title: requestTitle || `${selected.name} — ${matchedLocation}`,
          destination: matchedLocation,
          destinations: [{ label: matchedLocation }],
          start_date: serviceDate,
          end_date: serviceDate,
          notes,
          trip_id: attachToTrip && upcomingTrip ? upcomingTrip.id : undefined,
          passengers: client ? [{ name: client.name, age_category: 'adult', is_contact: true }] : [],
          items: [
            {
              pricing_id: selected.pricing_id,
              quantity,
              start_date: serviceDate,
              end_date: serviceDate,
              pickup_location: pickupLocation || undefined,
              dropoff_location: dropoffLocation || undefined,
              flight_number: flightNumber || undefined,
              service_time: serviceTime || undefined,
              details: transferType || undefined,
            },
          ],
        }),
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
        <h1 className="text-3xl font-bold text-foreground">{t('transferSearch.pageTitle')}</h1>
      </div>

      <Card className="p-4 bg-card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {t('transferSearch.destinationLabel')}
            </Label>
            <LocationCombobox
              value={destinationQuery}
              onChange={setDestinationQuery}
              locations={transferLocations}
              placeholder={t('transferSearch.destinationPlaceholder')}
            />
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

      {!matchedLocation ? (
        <p className="text-muted-foreground text-center py-12">{t('transferSearch.pickDestination')}</p>
      ) : results.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          {t('transferSearch.noResults', { location: matchedLocation })}
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
                  {matchedLocation} · {serviceDate} {serviceTime}
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
