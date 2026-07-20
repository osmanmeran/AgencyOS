import { Card } from '@/components/ui/card';
import { useT } from '@/lib/i18n/I18nContext';

export default function NotesAndTerms({ trip }) {
  const { t: _t } = useT();
  return (
    <>
      {trip.notes && (
        <Card className="p-6 bg-card shadow-lg print:shadow-none">
          <h2 className="text-lg font-bold text-foreground mb-3">{_t('reservationDetails.notes')}</h2>
          <p className="text-foreground whitespace-pre-wrap">{trip.notes}</p>
        </Card>
      )}
      {trip.terms_and_conditions && (
        <Card className="p-6 bg-muted print:bg-card print:shadow-none">
          <h2 className="text-lg font-bold text-foreground mb-3">{_t('reservationDetails.terms')}</h2>
          <p className="text-muted-foreground text-sm whitespace-pre-wrap">{trip.terms_and_conditions}</p>
        </Card>
      )}
      {trip.internal_notes && (
        <Card className="p-6 bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-400 print:shadow-none">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            {_t('reservationDetails.internal')}
          </h2>
          <p className="text-foreground whitespace-pre-wrap text-sm">{trip.internal_notes}</p>
        </Card>
      )}
    </>
  );
}
