import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';
import { CAR_RENTAL_LOCATIONS } from '@/lib/carRentalLocations';

// "Same as pick-up" is a sentinel, not a real location — keeps the drop-off
// Select single-purpose instead of a separate toggle + conditional field.
// Exported so callers (ClientPortal's hero) can share the same default.
export const SAME_AS_PICKUP = '__same__';

export default function CarRentalSearchBar({
  pickupLocation,
  onPickupLocationChange,
  dropoffLocation,
  onDropoffLocationChange,
  pickupDate,
  onPickupDateChange,
  dropoffDate,
  onDropoffDateChange,
  onSearch,
  className = '',
}) {
  const { t } = useT();

  return (
    <div
      className={`bg-card text-foreground rounded-xl p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end ${className}`}
    >
      <div className="md:col-span-3 space-y-1">
        <Label className="text-xs text-muted-foreground">{t('carRentalSearch.pickupLocation')}</Label>
        <Select value={pickupLocation} onValueChange={onPickupLocationChange}>
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
      <div className="md:col-span-3 space-y-1">
        <Label className="text-xs text-muted-foreground">{t('carRentalSearch.dropoffLocation')}</Label>
        <Select value={dropoffLocation} onValueChange={onDropoffLocationChange}>
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
      <div className="md:col-span-2">
        <DateField
          label={t('carRentalSearch.pickupDate')}
          value={pickupDate}
          onChange={onPickupDateChange}
          placeholder={t('carRentalSearch.pickupDate')}
        />
      </div>
      <div className="md:col-span-2">
        <DateField
          label={t('carRentalSearch.dropoffDate')}
          value={dropoffDate}
          onChange={onDropoffDateChange}
          minDate={pickupDate}
          placeholder={t('carRentalSearch.dropoffDate')}
        />
      </div>
      <div className="md:col-span-2">
        <Button className="w-full" onClick={onSearch}>
          <Search className="w-4 h-4 mr-1.5" /> {t('clientPortal.searchButton')}
        </Button>
      </div>
    </div>
  );
}
