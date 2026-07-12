import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building, Check, Car as CarIcon } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/formatters';
import { useT } from '@/lib/i18n/I18nContext';

// Car rental categories staff can pick in SupplierPricingManager.jsx —
// mirrors CAR_CATEGORY_LABELS in ClientQuoteBuilder.jsx (small enough to not
// warrant a shared module, same convention as that file's other small enum
// label maps).
const CAR_CATEGORY_LABELS = {
  economy: 'Economy',
  compact: 'Compact',
  intermediate: 'Intermediate',
  standard: 'Standard',
  fullsize: 'Full Size',
  premium: 'Premium',
  luxury: 'Luxury',
  suv: 'SUV',
  minivan: 'Minivan',
  convertible: 'Convertible',
};

export default function CarRentalResultCard({ item, days, onSelect }) {
  const { t } = useT();
  const sym = getCurrencySymbol(item.currency);
  const total = item.unit_price * days;
  const categoryLabel = CAR_CATEGORY_LABELS[item.car_category] || item.car_category;

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
            <CarIcon className="w-6 h-6 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building className="w-4 h-4 shrink-0" />
            <span className="truncate">{item.supplier_name}</span>
          </div>
          <div className="font-semibold text-foreground truncate">{item.name}</div>
          {categoryLabel && (
            <Badge variant="secondary" className="text-xs">
              {categoryLabel}
            </Badge>
          )}
        </div>

        <div className="col-span-2 sm:col-span-1 flex sm:flex-col items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
          <div className="text-right">
            <div className="text-lg font-bold text-foreground whitespace-nowrap">
              {sym}
              {item.unit_price.toFixed(2)}{' '}
              <span className="text-sm font-normal text-muted-foreground">{t('carRentalSearch.perDay')}</span>
            </div>
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {t('carRentalSearch.totalForDays', { count: days })}: {sym}
              {total.toFixed(2)}
            </div>
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
