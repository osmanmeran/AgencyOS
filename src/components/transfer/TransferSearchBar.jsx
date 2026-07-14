import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Users, Search } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';
import { TRANSFER_LOCATIONS } from '@/lib/transferLocations';

export default function TransferSearchBar({
  fromLocation,
  onFromLocationChange,
  toLocation,
  onToLocationChange,
  passengers,
  onPassengersChange,
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
          <MapPin className="w-3.5 h-3.5" /> {t('transferSearch.fromLabel')}
        </Label>
        <Select value={fromLocation} onValueChange={onFromLocationChange}>
          <SelectTrigger>
            <SelectValue placeholder={t('transferSearch.fromPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {TRANSFER_LOCATIONS.map((loc) => (
              <SelectItem key={loc} value={loc}>
                {loc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-4 space-y-1">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" /> {t('transferSearch.toLabel')}
        </Label>
        <Select value={toLocation} onValueChange={onToLocationChange}>
          <SelectTrigger>
            <SelectValue placeholder={t('transferSearch.toPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {TRANSFER_LOCATIONS.map((loc) => (
              <SelectItem key={loc} value={loc}>
                {loc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2 space-y-1">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <Users className="w-3.5 h-3.5" /> {t('transferSearch.passengers')}
        </Label>
        <Input
          type="number"
          min={1}
          value={passengers}
          onChange={(e) => onPassengersChange(Math.max(1, parseInt(e.target.value) || 1))}
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
