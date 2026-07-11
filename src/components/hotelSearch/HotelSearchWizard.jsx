import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, ChevronLeft, Minus, Plus, Search } from 'lucide-react';
import { getBlockingStopSale } from '@/lib/supplierStopSales';
import {
  locationOf,
  isLodgingCategory,
  resolveRoomRatesForRange,
  nightsBetween,
  unitPriceFor,
  suggestOccupancyForPax,
  OCCUPANCY_I18N_KEYS,
} from '@/lib/hotelPricing';
import { useT } from '@/lib/i18n/I18nContext';
import HotelResultCard from './HotelResultCard';

const STEPS = ['location', 'dates', 'passengers', 'occupancy', 'results'];

export default function HotelSearchWizard({ catalogItems, stopSales, onAddToCart }) {
  const { t } = useT();
  const [step, setStep] = useState('location');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [passengers, setPassengers] = useState(2);
  const [occupancy, setOccupancy] = useState('');

  const hotelItems = useMemo(() => catalogItems.filter((i) => isLodgingCategory(i.category_name)), [catalogItems]);

  const locations = useMemo(
    () => [...new Set(hotelItems.map(locationOf))].sort((a, b) => a.localeCompare(b)),
    [hotelItems],
  );

  const itemsAtLocation = useMemo(() => hotelItems.filter((i) => locationOf(i) === location), [hotelItems, location]);

  const occupancyOptions = useMemo(
    () => [...new Set(itemsAtLocation.map((i) => i.occupancy).filter(Boolean))],
    [itemsAtLocation],
  );

  const nights = nightsBetween(startDate, endDate);

  const results = useMemo(() => {
    if (!location || !occupancy || nights <= 0) return [];
    const candidates = itemsAtLocation.filter((i) => i.occupancy === occupancy);
    const matched = resolveRoomRatesForRange(candidates, startDate, endDate);
    return matched.filter((item) => !getBlockingStopSale(stopSales, item.supplier_id, startDate, endDate));
  }, [itemsAtLocation, occupancy, startDate, endDate, nights, location, stopSales]);

  const goTo = (s) => setStep(s);
  const stepIndex = STEPS.indexOf(step);

  const BackButton = ({ to }) => (
    <button
      type="button"
      onClick={() => goTo(to)}
      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
    >
      <ChevronLeft className="w-4 h-4" />
      {t('common.back')}
    </button>
  );

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? 'bg-primary' : 'bg-muted'}`} />
        ))}
      </div>

      {step === 'location' && (
        <div>
          <h3 className="font-semibold text-lg text-foreground mb-4">{t('hotelSearch.stepLocation')}</h3>
          {locations.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('hotelSearch.noLocationsAvailable')}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {locations.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    setLocation(loc);
                    setOccupancy('');
                    goTo('dates');
                  }}
                  className={`flex items-center gap-2 p-4 rounded-lg border text-left transition-colors ${
                    location === loc
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span className="font-medium truncate">{loc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'dates' && (
        <div>
          <BackButton to="location" />
          <h3 className="font-semibold text-lg text-foreground mb-4">{t('hotelSearch.stepDates')}</h3>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label>{t('hotelSearch.checkIn')}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>{t('hotelSearch.checkOut')}</Label>
              <Input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {nights > 0 && (
              <div className="text-sm text-muted-foreground pb-2">
                {t('hotelSearch.nightsCount', { count: nights })}
              </div>
            )}
          </div>
          <Button className="mt-4" disabled={nights <= 0} onClick={() => goTo('passengers')}>
            {t('common.search')}
          </Button>
        </div>
      )}

      {step === 'passengers' && (
        <div>
          <BackButton to="dates" />
          <h3 className="font-semibold text-lg text-foreground mb-4">{t('hotelSearch.stepPassengers')}</h3>
          <div className="flex items-center gap-4">
            <Label>{t('hotelSearch.guests')}</Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPassengers((p) => Math.max(1, p - 1))}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-border hover:bg-muted"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center font-semibold">{passengers}</span>
              <button
                type="button"
                onClick={() => setPassengers((p) => Math.min(20, p + 1))}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-border hover:bg-muted"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <Button
            className="mt-4"
            onClick={() => {
              setOccupancy(suggestOccupancyForPax(passengers));
              goTo('occupancy');
            }}
          >
            {t('common.search')}
          </Button>
        </div>
      )}

      {step === 'occupancy' && (
        <div>
          <BackButton to="passengers" />
          <h3 className="font-semibold text-lg text-foreground mb-4">{t('hotelSearch.stepOccupancy')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {occupancyOptions.map((occ) => (
              <button
                key={occ}
                type="button"
                onClick={() => {
                  setOccupancy(occ);
                  goTo('results');
                }}
                className={`p-4 rounded-lg border text-center font-medium transition-colors ${
                  occupancy === occ
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {t(OCCUPANCY_I18N_KEYS[occ] || '') || occ}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'results' && (
        <div>
          <BackButton to="occupancy" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg text-foreground">{t('hotelSearch.stepResults')}</h3>
            <span className="text-sm text-muted-foreground">
              {location} · {t('hotelSearch.nightsCount', { count: nights })}
            </span>
          </div>
          {results.length === 0 ? (
            <div className="text-center py-10">
              <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="font-medium text-foreground">{t('hotelSearch.noResultsTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('hotelSearch.noResultsBody')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((item) => (
                <HotelResultCard
                  key={item.pricing_id}
                  item={item}
                  unitPrice={unitPriceFor(item, 1)}
                  nights={nights}
                  onAdd={() => onAddToCart(item, unitPriceFor(item, 1), nights, startDate, endDate)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
