import { Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AGE_CATEGORIES } from './helpers';

// One passenger data-entry row — deliberately NOT the staff PassengerFieldsRow,
// which links to the full CRM client database a portal user can't access.
function PaxRow({ pax, onChange, onSetContact }) {
  const set = (field, value) => onChange({ ...pax, [field]: value });
  return (
    <div className="p-3 bg-card border border-border rounded-lg space-y-2">
      <div className="flex flex-wrap gap-2">
        <Input
          className="flex-1 min-w-[160px]"
          placeholder="Full name"
          value={pax.name}
          onChange={(e) => set('name', e.target.value)}
        />
        <Select value={pax.age_category} onValueChange={(v) => set('age_category', v)}>
          <SelectTrigger className="w-32">
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
        <button
          type="button"
          onClick={onSetContact}
          className={`px-3 rounded-lg text-xs font-medium border flex items-center gap-1 ${pax.is_contact ? 'bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-700 dark:text-green-300' : 'bg-muted border-border text-muted-foreground'}`}
          title="Main contact"
        >
          <Star className="w-3.5 h-3.5" fill={pax.is_contact ? 'currentColor' : 'none'} />
          Contact
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          className="flex-1 min-w-[130px]"
          type="date"
          title="Date of birth"
          value={pax.date_of_birth}
          onChange={(e) => set('date_of_birth', e.target.value)}
        />
        <Input
          className="flex-1 min-w-[130px]"
          placeholder="Passport #"
          value={pax.passport_number}
          onChange={(e) => set('passport_number', e.target.value)}
        />
        <Input
          className="flex-1 min-w-[130px]"
          placeholder="Phone"
          value={pax.phone}
          onChange={(e) => set('phone', e.target.value)}
        />
        <Input
          className="flex-1 min-w-[160px]"
          placeholder="Email"
          value={pax.email}
          onChange={(e) => set('email', e.target.value)}
        />
      </div>
    </div>
  );
}

export default PaxRow;
