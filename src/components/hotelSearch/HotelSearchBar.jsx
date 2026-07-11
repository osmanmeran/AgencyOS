import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const filteredLocations = React.useMemo(() => {
    const q = destinationQuery.trim().toLowerCase();
    const matches = q ? hotelLocations.filter((loc) => loc.toLowerCase().includes(q)) : hotelLocations;
    return matches.slice(0, 8);
  }, [hotelLocations, destinationQuery]);

  return (
    <div
      className={`bg-card text-foreground rounded-xl p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end ${className}`}
    >
      <div className="md:col-span-4 space-y-1 relative">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" /> {t('clientPortal.searchDestinationPlaceholder')}
        </Label>
        <Input
          value={destinationQuery}
          onChange={(e) => {
            onDestinationChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setShowSuggestions(false)}
          placeholder={t('clientPortal.searchDestinationPlaceholder')}
          autoComplete="off"
        />
        {showSuggestions && filteredLocations.length > 0 && (
          <div className="absolute z-20 top-full mt-1 w-full bg-popover text-popover-foreground border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {filteredLocations.map((loc) => (
              <button
                key={loc}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onDestinationChange(loc);
                  setShowSuggestions(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
              >
                {loc}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="md:col-span-2 space-y-1">
        <Label className="text-xs text-muted-foreground">{t('clientPortal.searchCheckIn')}</Label>
        <Input type="date" value={checkIn} onChange={(e) => onCheckInChange(e.target.value)} />
      </div>
      <div className="md:col-span-2 space-y-1">
        <Label className="text-xs text-muted-foreground">{t('clientPortal.searchCheckOut')}</Label>
        <Input
          type="date"
          value={checkOut}
          min={checkIn || undefined}
          onChange={(e) => onCheckOutChange(e.target.value)}
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
