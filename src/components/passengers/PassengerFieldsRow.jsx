import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, Trash2 } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';
import ClientLinkPicker from './ClientLinkPicker';

// Shared passenger data-entry row used by both the normal reservation
// builder (CreateReservation.jsx) and the "Generate from Contract" flow.
// Every field is optional — linking a Client just pre-fills them as
// editable defaults, it doesn't bind the passenger to the record live.
/**
 * @param {{ passenger: any, onChange: any, onRemove?: any, showContact?: any, onSetContact?: any }} props
 */
export default function PassengerFieldsRow({ passenger, onChange, onRemove, showContact, onSetContact }) {
  const { t } = useT();
  const AGE_CATEGORIES = [
    { value: 'adult', label: t('passengers.adult') },
    { value: 'children', label: t('passengers.children') },
    { value: 'infant', label: t('passengers.infant') },
  ];

  const set = (field, value) => onChange({ ...passenger, [field]: value });

  const handleClientSelect = (client) => {
    onChange({
      ...passenger,
      client_id: client.id,
      name: client.name || passenger.name,
      phone: client.phone || passenger.phone,
      email: client.email || passenger.email,
      date_of_birth: client.date_of_birth || passenger.date_of_birth,
      age_category: client.age_category || passenger.age_category || 'adult',
    });
  };

  return (
    <div className="p-3 bg-card border border-border rounded-lg space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={passenger.name || ''}
          onChange={(e) => set('name', e.target.value)}
          placeholder={t('passengers.namePlaceholder')}
          className="flex-1 h-9 text-sm"
        />
        {showContact && (
          <button
            type="button"
            onClick={onSetContact}
            title={passenger.is_contact ? t('passengers.bookingContact') : t('passengers.setAsContact')}
            className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${passenger.is_contact ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300' : 'text-muted-foreground hover:text-amber-400'}`}
          >
            <Star className="w-4 h-4" fill={passenger.is_contact ? 'currentColor' : 'none'} />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-red-400 hover:text-red-600 dark:hover:text-red-300 flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="w-64 max-w-full">
        <ClientLinkPicker
          clientId={passenger.client_id}
          clientName={passenger.name}
          onSelect={handleClientSelect}
          onClear={() => set('client_id', '')}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <Label className="text-[11px] text-muted-foreground mb-0.5 block">{t('passengers.age')}</Label>
          <Select value={passenger.age_category || 'adult'} onValueChange={(v) => set('age_category', v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGE_CATEGORIES.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground mb-0.5 block">{t('common.phone')}</Label>
          <Input value={passenger.phone || ''} onChange={(e) => set('phone', e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground mb-0.5 block">{t('common.email')}</Label>
          <Input
            type="email"
            value={passenger.email || ''}
            onChange={(e) => set('email', e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground mb-0.5 block">{t('crm.dateOfBirth')}</Label>
          <Input
            type="date"
            value={passenger.date_of_birth || ''}
            onChange={(e) => set('date_of_birth', e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="col-span-2 md:col-span-4">
          <Label className="text-[11px] text-muted-foreground mb-0.5 block">{t('passengers.fileNumber')}</Label>
          <Input
            value={passenger.numero_pratica || ''}
            onChange={(e) => set('numero_pratica', e.target.value)}
            placeholder={t('passengers.fileNumberPlaceholder')}
            className="h-8 text-xs"
          />
        </div>
      </div>
    </div>
  );
}
