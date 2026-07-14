import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function NotesTermsCard({ formData, setFormData }) {
  return (
    <Card className="p-6 bg-card shadow-md">
      <h2 className="text-lg font-bold text-foreground mb-4">Notes & Terms</h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            placeholder="Special notes for the client..."
          />
        </div>
        <div className="space-y-2">
          <Label>Terms & Conditions</Label>
          <Textarea
            value={formData.terms_and_conditions}
            onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            Internal Notes (staff only)
          </Label>
          <Textarea
            value={formData.internal_notes}
            onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
            rows={3}
            placeholder="Notes visible only to internal users..."
            className="border-amber-200 dark:border-amber-800 focus-visible:ring-amber-400"
          />
        </div>
      </div>
    </Card>
  );
}
