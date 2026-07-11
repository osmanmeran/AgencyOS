import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Trash2, Loader2, Send, ShoppingCart } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/formatters';
import { OCCUPANCY_I18N_KEYS, MEAL_TREATMENT_I18N_KEYS } from '@/lib/hotelPricing';
import { useT } from '@/lib/i18n/I18nContext';

export default function HotelCart({
  cart,
  onUpdateQuantity,
  onRemove,
  trip,
  onTripChange,
  onSubmit,
  submitting,
  disabled,
}) {
  const { t } = useT();

  if (cart.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <ShoppingCart className="w-6 h-6 mx-auto mb-2 opacity-50" />
        {t('hotelSearch.emptyCart')}
      </Card>
    );
  }

  const grandTotal = cart.reduce((sum, l) => sum + l.unit_price * l.nights * l.quantity, 0);
  const currency = cart[0]?.currency;

  return (
    <Card className="p-4 space-y-4">
      <h3 className="font-semibold text-foreground">{t('hotelSearch.yourCart')}</h3>
      <div className="space-y-3">
        {cart.map((line) => {
          const sym = getCurrencySymbol(line.currency);
          const lineTotal = line.unit_price * line.nights * line.quantity;
          const minQty = line.min_quantity || 1;
          const maxQty = line.max_quantity || 99;
          return (
            <div key={line._key} className="p-3 bg-muted/40 rounded-lg space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{line.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {line.start_date} → {line.end_date} · {t('hotelSearch.nightsCount', { count: line.nights })}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1 text-xs text-muted-foreground">
                    {line.occupancy && <span>{t(OCCUPANCY_I18N_KEYS[line.occupancy] || '') || line.occupancy}</span>}
                    {line.meal_treatment && (
                      <span>· {t(MEAL_TREATMENT_I18N_KEYS[line.meal_treatment] || '') || line.meal_treatment}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(line._key)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  title={t('hotelSearch.remove')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">{t('hotelSearch.rooms')}</Label>
                  <Input
                    type="number"
                    min={minQty}
                    max={maxQty}
                    value={line.quantity}
                    onChange={(e) =>
                      onUpdateQuantity(line._key, Math.min(maxQty, Math.max(minQty, Number(e.target.value) || minQty)))
                    }
                    className="w-16 h-8 text-sm"
                  />
                </div>
                <div className="font-semibold text-foreground">
                  {sym}
                  {lineTotal.toFixed(2)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Separator />

      <div className="flex items-center justify-between font-bold text-foreground">
        <span>{t('hotelSearch.estimatedTotal')}</span>
        <span>
          {getCurrencySymbol(currency)}
          {grandTotal.toFixed(2)}
        </span>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="hotel-trip-title" className="text-sm">
          {t('hotelSearch.tripTitleLabel')}
        </Label>
        <Input
          id="hotel-trip-title"
          value={trip.title}
          placeholder={t('hotelSearch.tripTitlePlaceholder')}
          onChange={(e) => onTripChange({ ...trip, title: e.target.value })}
        />
        <Label htmlFor="hotel-trip-notes" className="text-sm">
          {t('hotelSearch.notesLabel')}
        </Label>
        <Textarea
          id="hotel-trip-notes"
          value={trip.notes}
          placeholder={t('hotelSearch.notesPlaceholder')}
          onChange={(e) => onTripChange({ ...trip, notes: e.target.value })}
          rows={2}
        />
      </div>

      <Button className="w-full" disabled={disabled || submitting} onClick={onSubmit}>
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {t('hotelSearch.submitting')}
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            {t('hotelSearch.submitRequest')}
          </>
        )}
      </Button>
    </Card>
  );
}
