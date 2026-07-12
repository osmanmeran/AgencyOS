import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, Check, ArrowRightLeft } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/formatters';
import { unitPriceFor } from '@/lib/hotelPricing';
import { useT } from '@/lib/i18n/I18nContext';

// Same flat/per-group unit convention used across the car rental and hotel
// transfer add-on flows — a transfer priced this way doesn't scale with
// passenger count.
const FIXED_UNITS = ['per_group', 'flat_rate'];

export default function TransferResultCard({ item, passengers, onSelect }) {
  const { t } = useT();
  const sym = getCurrencySymbol(item.currency);
  const quantity = FIXED_UNITS.includes(item.unit) ? 1 : Math.max(1, passengers);
  const total = unitPriceFor(item, quantity) * quantity;

  return (
    <Card className="p-4">
      <div className="grid grid-cols-[5rem_minmax(0,1fr)] sm:grid-cols-[9rem_minmax(0,1fr)_auto] gap-4 items-start">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-20 h-20 sm:w-full sm:h-32 rounded-lg object-cover bg-muted"
          />
        ) : (
          <div className="w-20 h-20 sm:w-full sm:h-32 rounded-lg bg-muted flex items-center justify-center">
            <ArrowRightLeft className="w-6 h-6 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building className="w-4 h-4 shrink-0" />
            <span className="truncate">{item.supplier_name}</span>
          </div>
          <div className="font-semibold text-foreground truncate">{item.name}</div>
        </div>

        <div className="col-span-2 sm:col-span-1 flex sm:flex-col items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
          <div className="text-lg font-bold text-foreground whitespace-nowrap">
            {sym}
            {total.toFixed(2)}
          </div>
          <Button size="sm" onClick={() => onSelect(item)} className="whitespace-nowrap">
            <Check className="w-4 h-4 mr-1" />
            {t('hotelSearch.selectRoom')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
