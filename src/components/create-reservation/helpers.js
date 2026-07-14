import { getCurrencySymbol } from '@/lib/formatters';
import { DEFAULT_CURRENCIES } from '@/lib/currencies';
import { Building, ArrowRightLeft, User, Coffee, Plane, Map, Zap } from 'lucide-react';

export const CURRENCIES = DEFAULT_CURRENCIES;

export const currSymbol = (cur) => getCurrencySymbol(cur);

export const newPassenger = () => ({
  id: `pax-${Date.now()}-${Math.random()}`,
  name: '',
  is_contact: false,
  client_id: '',
  age_category: 'adult',
  phone: '',
  email: '',
  date_of_birth: '',
  numero_pratica: '',
});

export const newRoom = () => ({
  id: `room-${Date.now()}-${Math.random()}`,
  type: 'double',
  passengers: [newPassenger(), newPassenger()],
});

export const autoGenerateRooms = (count) => {
  if (count <= 0) return [newRoom()];
  const rooms = [];
  let remaining = count;
  while (remaining > 0) {
    let type = 'single';
    if (remaining >= 2) {
      type = 'double';
      remaining -= 2;
    } else {
      type = 'single';
      remaining -= 1;
    }
    const passengers = Array.from({ length: type === 'double' ? 2 : 1 }, () => newPassenger());
    rooms.push({ id: `room-${Date.now()}-${Math.random()}-${rooms.length}`, type, passengers });
  }
  return rooms;
};

export const emptyService = () => ({
  _key: `svc-${Date.now()}-${Math.random()}`,
  supplier_id: '',
  name: '',
  description: '',
  category: '',
  location: '',
  acquiring_price: '',
  selling_price: '',
  quantity: 1,
  unit: 'per_person',
  supplier_currency: 'USD',
  client_currency: 'USD',
});

export const sortByDate = (a, b) => {
  const aStart = a.start_date || '';
  const bStart = b.start_date || '';
  if (aStart < bStart) return -1;
  if (aStart > bStart) return 1;
  const aEnd = a.end_date || '';
  const bEnd = b.end_date || '';
  if (aEnd < bEnd) return -1;
  if (aEnd > bEnd) return 1;
  return (a.name || '').localeCompare(b.name || '');
};

export const SERVICE_TYPES = [
  { key: 'lodging', label: 'Lodging' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'guides', label: 'Guides' },
  { key: 'restaurants', label: 'Restaurants' },
  { key: 'transportation', label: 'Transportation' },
  { key: 'guided_tours', label: 'Guided Tours' },
  { key: 'extra_activities', label: 'Extra Activities' },
];

export const SERVICE_TYPE_ICONS = {
  lodging: Building,
  transfers: ArrowRightLeft,
  guides: User,
  restaurants: Coffee,
  transportation: Plane,
  guided_tours: Map,
  extra_activities: Zap,
};
