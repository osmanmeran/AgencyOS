import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/lib/i18n/I18nContext';

export default function NotesTermsCard({ formData, setFormData }) {
  const { t: _t } = useT();
  return (
    <Card className="p-6 bg-card shadow-md">
      <h2 className="text-lg font-bold text-foreground mb-4">{_t('createReservation.notes_2')}</h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{_t('createReservation.notes_2')}</Label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            placeholder={_t('createReservation.special')}
          />
        </div>
        <div className="space-y-2">
          <Label>{_t('createReservation.terms')}</Label>
          <Textarea
            value={formData.terms_and_conditions}
            onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            {_t('createReservation.internal')}
          </Label>
          <Textarea
            value={formData.internal_notes}
            onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
            rows={3}
            placeholder={_t('createReservation.notesVisible')}
            className="border-amber-200 dark:border-amber-800 focus-visible:ring-amber-400"
          />
        </div>
      </div>
    </Card>
  );
}
