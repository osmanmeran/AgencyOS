import { format, parseISO } from 'date-fns';
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n/I18nContext';

// Lets a client fold a new hotel/transfer/car-rental request into an
// existing upcoming trip instead of submitting it standalone — shown in the
// review dialog of ClientHotelSearch.jsx / ClientTransferSearch.jsx /
// ClientCarRentalSearch.jsx whenever they have an upcoming trip (see
// useUpcomingTrip.js). Renders nothing if there's no trip to offer.
export default function TripAttachChoice({ trip, attach, onChange }) {
  const { t } = useT();
  if (!trip) return null;
  const dates = `${format(parseISO(trip.start_date), 'MMM d')} – ${format(parseISO(trip.end_date), 'MMM d, yyyy')}`;

  return (
    <div className="space-y-2">
      <Label className="text-sm">{t('tripAttach.label')}</Label>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
            attach ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground'
          }`}
        >
          {t('tripAttach.attachOption', { name: trip.name, dates })}
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
            !attach ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground'
          }`}
        >
          {t('tripAttach.separateOption')}
        </button>
      </div>
    </div>
  );
}
