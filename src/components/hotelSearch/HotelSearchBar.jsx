import React from 'react';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { MapPin, Users, Search, CalendarDays } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

// A native <input type="date"> was invisible/unreliable here (its calendar
// icon and popup follow the OS theme, not this app's, and its clickable area
// varies a lot by browser). Same Popover+Calendar pattern already used for
// date-range picking in SupplierStopSales.jsx, just single-date — a button
// trigger with its own calendar icon and a dropdown that always renders the
// same way regardless of browser/OS theme.
function DateField({ label, value, onChange, minDate = undefined, placeholder }) {
  const selectedDate = value ? parseISO(value) : undefined;
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-start font-normal">
            <CalendarDays className="w-4 h-4 mr-2 shrink-0 text-muted-foreground" />
            <span className="truncate">{selectedDate ? format(selectedDate, 'MMM d, yyyy') : placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
            disabled={minDate ? { before: parseISO(minDate) } : undefined}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

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
