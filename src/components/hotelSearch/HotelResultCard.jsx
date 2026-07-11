import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building, Plus } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/formatters';
import { OCCUPANCY_I18N_KEYS, MEAL_TREATMENT_I18N_KEYS } from '@/lib/hotelPricing';
import { useT } from '@/lib/i18n/I18nContext';

export default function HotelResultCard({ item, unitPrice, nights, onAdd }) {
  const { t } = useT();
  const sym = getCurrencySymbol(item.currency);
  const total = unitPrice * nights;

  return (
    <Card className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Building className="w-4 h-4 shrink-0" />
          <span className="truncate">{item.supplier_name}</span>
        </div>
        <div className="font-semibold text-foreground truncate">{item.name}</div>
        <div className="flex flex-wrap gap-2 mt-2">
          {item.occupancy && (
            <Badge variant="secondary" className="text-xs">
              {t(OCCUPANCY_I18N_KEYS[item.occupancy] || '') || item.occupancy}
            </Badge>
          )}
          {item.meal_treatment && (
            <Badge variant="secondary" className="text-xs">
              {t(MEAL_TREATMENT_I18N_KEYS[item.meal_treatment] || '') || item.meal_treatment}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
        <div className="text-right">
          <div className="text-lg font-bold text-foreground">
            {sym}
            {unitPrice.toFixed(2)}{' '}
            <span className="text-sm font-normal text-muted-foreground">{t('hotelSearch.perNight')}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {t('hotelSearch.totalForStay', { nights })}: {sym}
            {total.toFixed(2)}
          </div>
        </div>
        <Button size="sm" onClick={() => onAdd(item)} className="whitespace-nowrap">
          <Plus className="w-4 h-4 mr-1" />
          {t('hotelSearch.addToCart')}
        </Button>
      </div>
    </Card>
  );
}
