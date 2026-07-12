import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { LocationCombobox } from '@/components/ui/location-combobox';
import { MapPin, Users, Search } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

// Destination is restricted to real hotel locations (not free text) — the
// suggestion list comes from the client's own catalog (see hotelLocations in
// ClientPortal.jsx / ClientHotelSearch.jsx), so a search can only ever hand
// off a location that actually has inventory behind it.
export default function HotelSearchBar({
  hotelLocations,
  destinationQuery,
  onDestinationChange,
  checkIn,
  onCheckInChange,
  checkOut,
  onCheckOutChange,
  guests,
  onGuestsChange,
  onSearch,
  className = '',
}) {
  const { t } = useT();

  return (
    <div
      className={`bg-card text-foreground rounded-xl p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end ${className}`}
    >
      <div className="md:col-span-4 space-y-1">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" /> {t('clientPortal.searchDestinationPlaceholder')}
        </Label>
        <LocationCombobox
          value={destinationQuery}
          onChange={onDestinationChange}
          locations={hotelLocations}
          placeholder={t('clientPortal.searchDestinationPlaceholder')}
        />
      </div>
      <div className="md:col-span-2">
        <DateField
          label={t('clientPortal.searchCheckIn')}
          value={checkIn}
          onChange={onCheckInChange}
          placeholder={t('clientPortal.searchCheckIn')}
        />
      </div>
      <div className="md:col-span-2">
        <DateField
          label={t('clientPortal.searchCheckOut')}
          value={checkOut}
          onChange={onCheckOutChange}
          minDate={checkIn}
          placeholder={t('clientPortal.searchCheckOut')}
        />
      </div>
      <div className="md:col-span-2 space-y-1">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <Users className="w-3.5 h-3.5" /> {t('clientPortal.searchGuests')}
        </Label>
        <Input
          type="number"
          min={1}
          value={guests}
          onChange={(e) => onGuestsChange(Math.max(1, parseInt(e.target.value) || 1))}
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
