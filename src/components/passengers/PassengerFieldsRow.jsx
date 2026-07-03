import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, Trash2 } from 'lucide-react';
import ClientLinkPicker from './ClientLinkPicker';

const AGE_CATEGORIES = [
  { value: 'adult', label: 'Adult' },
  { value: 'children', label: 'Children (3–11.99 anni)' },
  { value: 'infant', label: 'Infant (0–2.99 anni)' },
];

// Shared passenger data-entry row used by both the normal reservation
// builder (CreateReservation.jsx) and the "Generate from Contract" flow.
// Every field is optional — linking a Client just pre-fills them as
// editable defaults, it doesn't bind the passenger to the record live.
/**
 * @param {{ passenger: any, onChange: any, onRemove?: any, showContact?: any, onSetContact?: any }} props
 */
export default function PassengerFieldsRow({ passenger, onChange, onRemove, showContact, onSetContact }) {
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
    <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={passenger.name || ''}
          onChange={e => set('name', e.target.value)}
          placeholder="Nome passeggero…"
          className="flex-1 h-9 text-sm"
        />
        {showContact && (
          <button
            type="button"
            onClick={onSetContact}
            title={passenger.is_contact ? 'Contatto della prenotazione' : 'Imposta come contatto'}
            className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${passenger.is_contact ? 'bg-amber-100 text-amber-600' : 'text-slate-300 hover:text-amber-400'}`}
          >
            <Star className="w-4 h-4" fill={passenger.is_contact ? 'currentColor' : 'none'} />
          </button>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} className="p-1.5 text-red-400 hover:text-red-600 flex-shrink-0">
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
          <Label className="text-[11px] text-slate-500 mb-0.5 block">Età</Label>
          <Select value={passenger.age_category || 'adult'} onValueChange={v => set('age_category', v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AGE_CATEGORIES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-slate-500 mb-0.5 block">Telefono</Label>
          <Input value={passenger.phone || ''} onChange={e => set('phone', e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-slate-500 mb-0.5 block">Email</Label>
          <Input type="email" value={passenger.email || ''} onChange={e => set('email', e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[11px] text-slate-500 mb-0.5 block">Data di nascita</Label>
          <Input type="date" value={passenger.date_of_birth || ''} onChange={e => set('date_of_birth', e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="col-span-2 md:col-span-4">
          <Label className="text-[11px] text-slate-500 mb-0.5 block">Numero pratica</Label>
          <Input value={passenger.numero_pratica || ''} onChange={e => set('numero_pratica', e.target.value)} placeholder="Facoltativo" className="h-8 text-xs" />
        </div>
      </div>
    </div>
  );
}
