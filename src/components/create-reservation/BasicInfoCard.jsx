import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useT } from '@/lib/i18n/I18nContext';

export default function BasicInfoCard({ formData, setFormData, departments }) {
  const { t: _t } = useT();
  return (
    <Card className="p-6 bg-card shadow-md">
      <h2 className="text-lg font-bold text-foreground mb-4">{_t('createReservation.reservation')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{_t('createReservation.reservationName')}</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={_t('createReservation.summer')}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>{_t('createReservation.destination')}</Label>
          <Input
            value={formData.destination}
            onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
            placeholder={_t('createReservation.bali')}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>{_t('createReservation.start')}</Label>
          <Input
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>{_t('createReservation.end')}</Label>
          <Input
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>{_t('createReservation.department')}</Label>
          <Select value={formData.department} onValueChange={(v) => setFormData({ ...formData, department: v })}>
            <SelectTrigger>
              <SelectValue placeholder={_t('createReservation.select')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>{_t('createReservation.general')}</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{_t('createReservation.cover')}</Label>
          <Input
            value={formData.image_url}
            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
      </div>
    </Card>
  );
}
