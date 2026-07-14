import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Star } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';
import { tourStartingPrice, activeDiscount } from '@/lib/tourPricing';
import { sym } from './helpers';

// One service line: the client picks a service via the category -> location
// -> supplier -> service dropdown chain, then fills in day-specific details
// for it — mirroring the staff reservation builder's
// per-category fields, minus anything cost/margin/supplier related. Prices
// shown here are the client's own sell price: pulled from the catalog
// (server already applied the client's markup and converted to their
// preferred currency).
function TourPickerDialog({ open, onOpenChange, tours, onSelect }) {
  const { t } = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('quoteBuilder.addTour')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {tours.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">{t('quoteBuilder.noTours')}</p>
          ) : (
            tours.map((tour) => {
              const start = tourStartingPrice(tour);
              const disc = activeDiscount(tour);
              return (
                <button
                  key={tour.id}
                  type="button"
                  onClick={() => onSelect(tour)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-muted hover:border-blue-300 dark:hover:border-blue-800 transition-colors text-left"
                >
                  {tour.coverImage ? (
                    <img src={tour.coverImage} alt="" className="w-14 h-14 rounded-md object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-md bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                      <Star className="w-5 h-5 text-blue-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{tour.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {tour.mode === 'multiday' ? t('quoteBuilder.multiDay') : t('quoteBuilder.daily')}
                      {tour.location ? ` · ${tour.location}` : ''}
                    </div>
                    {start != null && (
                      <div className="text-xs mt-0.5">
                        {disc && (
                          <span className="line-through text-muted-foreground mr-1">
                            {sym(tour.currency || 'USD')}
                            {start.toFixed(2)}
                          </span>
                        )}
                        <span className="text-muted-foreground mr-0.5">{t('clientPortal.fromLabel')}</span>
                        <span className="font-medium text-green-700 dark:text-green-300">
                          {sym(tour.currency || 'USD')}
                          {(disc ? disc.discounted : start).toFixed(2)}
                        </span>
                        <span className="text-muted-foreground"> {t('quoteBuilder.perPerson')}</span>
                        {disc && (
                          <span className="ml-1 text-xs bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded-full">
                            -{disc.percent}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TourPickerDialog;
