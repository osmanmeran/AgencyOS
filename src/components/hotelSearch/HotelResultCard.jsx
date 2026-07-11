import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building, Check, MapPin, Star, Globe, Image as ImageIcon } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/formatters';
import { OCCUPANCY_I18N_KEYS, MEAL_TREATMENT_I18N_KEYS } from '@/lib/hotelPricing';
import { isNumericStar, formatHotelType } from '@/lib/hotelTypes';
import { useT } from '@/lib/i18n/I18nContext';

export default function HotelResultCard({ item, unitPrice, nights, onSelect }) {
  const { t } = useT();
  const sym = getCurrencySymbol(item.currency);
  const total = unitPrice * nights;
  const ratingLabel = item.rating != null && item.rating !== '' ? formatHotelType(item.rating) : '';
  const starCount = item.rating != null && isNumericStar(item.rating) ? Math.round(Number(item.rating)) : 0;
  const locationLine = [item.area, item.city].filter(Boolean).join(', ');

  return (
    <Card className="p-4 flex flex-col sm:flex-row gap-4">
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full sm:w-36 h-36 sm:h-auto rounded-lg object-cover shrink-0 bg-muted"
        />
      ) : (
        <div className="w-full sm:w-36 h-36 sm:h-auto rounded-lg bg-muted flex items-center justify-center shrink-0">
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building className="w-4 h-4 shrink-0" />
            <span className="truncate">{item.supplier_name}</span>
          </div>
          <div className="font-semibold text-foreground truncate">{item.name}</div>

          {starCount > 0 ? (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: starCount }).map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              ))}
            </div>
          ) : (
            ratingLabel && (
              <Badge variant="outline" className="text-xs">
                {ratingLabel}
              </Badge>
            )
          )}

          {locationLine && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{locationLine}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
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

          {item.website && (
            <a
              href={item.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-300 hover:underline"
            >
              <Globe className="w-3.5 h-3.5" />
              Website
            </a>
          )}
        </div>

        <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 shrink-0">
          <div className="text-right">
            <div className="text-lg font-bold text-foreground whitespace-nowrap">
              {sym}
              {unitPrice.toFixed(2)}{' '}
              <span className="text-sm font-normal text-muted-foreground">{t('hotelSearch.perNight')}</span>
            </div>
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {t('hotelSearch.totalForStay', { nights })}: {sym}
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
