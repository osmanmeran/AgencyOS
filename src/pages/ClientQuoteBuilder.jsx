import { db } from '@/lib/DbContext';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { SkeletonCard } from '@/components/ui/skeletons';
import { Plus, Trash2, Users, Star, Building, ArrowRightLeft, Send, Loader2, MapPin } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';
import { getStorefront, getSupplierCatalog, submitQuote } from '@/lib/b2bApi';

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', TRY: '₺', AED: 'د.إ', SAR: '﷼', EGP: 'E£', MAD: 'MAD', JPY: '¥', CHF: 'CHF', CAD: 'CA$', AUD: 'A$' };
const sym = (cur) => CURRENCY_SYMBOLS[cur] || `${cur} `;

const AGE_CATEGORIES = [
  { value: 'adult', label: 'Adult' },
  { value: 'children', label: 'Child (3–11)' },
  { value: 'infant', label: 'Infant (0–2)' },
];

const NIGHT_UNITS = ['per_night', 'per_day'];

const rid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const newPassenger = () => ({ id: rid('pax'), name: '', age_category: 'adult', date_of_birth: '', passport_number: '', phone: '', email: '', is_contact: false });
const newRoom = () => ({ id: rid('room'), type: 'double', passengers: [newPassenger(), newPassenger()] });
const newLine = () => ({ _key: rid('line'), supplier_id: '', pricing_id: '', service_name: '', unit: '', unit_price: 0, min_quantity: 1, quantity: 1, start_date: '', end_date: '', room_type: '', pickup_location: '', dropoff_location: '', flight_number: '', service_time: '', details: '' });

function nightsBetween(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 86400000);
}

function lineTotal(line) {
  if (!line.unit_price) return 0;
  if (line.unit === 'per_group' || line.unit === 'flat_rate') return line.unit_price;
  let qty = Math.max(1, line.quantity || 1);
  if (NIGHT_UNITS.includes(line.unit)) {
    const n = nightsBetween(line.start_date, line.end_date);
    if (n > 0) qty *= n;
  }
  return line.unit_price * qty;
}

// One passenger data-entry row — deliberately NOT the staff PassengerFieldsRow,
// which links to the full CRM client database a portal user can't access.
function PaxRow({ pax, onChange, onSetContact }) {
  const set = (field, value) => onChange({ ...pax, [field]: value });
  return (
    <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
      <div className="flex flex-wrap gap-2">
        <Input className="flex-1 min-w-[160px]" placeholder="Full name" value={pax.name} onChange={e => set('name', e.target.value)} />
        <Select value={pax.age_category} onValueChange={v => set('age_category', v)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{AGE_CATEGORIES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
        </Select>
        <button
          type="button"
          onClick={onSetContact}
          className={`px-3 rounded-lg text-xs font-medium border flex items-center gap-1 ${pax.is_contact ? 'bg-green-50 border-green-300 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
          title="Main contact"
        >
          <Star className="w-3.5 h-3.5" fill={pax.is_contact ? 'currentColor' : 'none'} />Contact
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input className="flex-1 min-w-[130px]" type="date" title="Date of birth" value={pax.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
        <Input className="flex-1 min-w-[130px]" placeholder="Passport #" value={pax.passport_number} onChange={e => set('passport_number', e.target.value)} />
        <Input className="flex-1 min-w-[130px]" placeholder="Phone" value={pax.phone} onChange={e => set('phone', e.target.value)} />
        <Input className="flex-1 min-w-[160px]" placeholder="Email" value={pax.email} onChange={e => set('email', e.target.value)} />
      </div>
    </div>
  );
}

// One service line: pick a published supplier, then one of its approved
// catalog services (prices already in the client's currency), then trip
// details. No cost / margin is ever shown.
function ServiceLineCard({ line, suppliers, currency, onChange, onRemove }) {
  const { data } = /** @type {any} */ (useQuery({
    queryKey: ['b2bSupplier', line.supplier_id],
    queryFn: () => getSupplierCatalog(line.supplier_id),
    enabled: !!line.supplier_id,
  }));
  const services = data?.items || [];

  const pickSupplier = (supplier_id) => onChange({ ...line, supplier_id, pricing_id: '', service_name: '', unit: '', unit_price: 0, min_quantity: 1, quantity: 1 });
  const pickService = (pricing_id) => {
    const svc = services.find(s => s.pricing_id === pricing_id);
    if (!svc) return;
    onChange({ ...line, pricing_id, service_name: svc.name, unit: svc.unit, unit_price: svc.unit_price, min_quantity: svc.min_quantity || 1, quantity: Math.max(line.quantity || 1, svc.min_quantity || 1) });
  };
  const set = (field, value) => onChange({ ...line, [field]: value });

  const isNightly = NIGHT_UNITS.includes(line.unit);
  const isFixed = line.unit === 'per_group' || line.unit === 'flat_rate';
  const nights = nightsBetween(line.start_date, line.end_date);

  return (
    <div className="border border-slate-200 rounded-lg bg-slate-50 p-4 space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] space-y-1">
          <Label className="text-xs text-slate-500">Supplier</Label>
          <Select value={line.supplier_id} onValueChange={pickSupplier}>
            <SelectTrigger><SelectValue placeholder="Choose a supplier" /></SelectTrigger>
            <SelectContent>
              {suppliers.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}{s.category_name ? ` · ${s.category_name}` : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px] space-y-1">
          <Label className="text-xs text-slate-500">Service</Label>
          <Select value={line.pricing_id} onValueChange={pickService} disabled={!line.supplier_id}>
            <SelectTrigger><SelectValue placeholder={line.supplier_id ? 'Choose a service' : 'Select supplier first'} /></SelectTrigger>
            <SelectContent>
              {services.map(s => (
                <SelectItem key={s.pricing_id} value={s.pricing_id}>{s.name} — {sym(currency)}{s.unit_price.toFixed(2)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="ghost" size="icon" className="self-end text-red-400 hover:text-red-600 hover:bg-red-50" onClick={onRemove}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {line.pricing_id && (
        <>
          <div className="flex flex-wrap gap-3">
            {isNightly && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Check-in</Label>
                  <Input type="date" className="w-40" value={line.start_date} onChange={e => set('start_date', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Check-out</Label>
                  <Input type="date" className="w-40" value={line.end_date} onChange={e => set('end_date', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Room type</Label>
                  <Input className="w-36" placeholder="e.g. Double" value={line.room_type} onChange={e => set('room_type', e.target.value)} />
                </div>
              </>
            )}
            {!isFixed && (
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">{isNightly ? 'Rooms / units' : 'Quantity'}</Label>
                <Input type="number" min={line.min_quantity || 1} className="w-28" value={line.quantity}
                  onChange={e => set('quantity', Math.max(line.min_quantity || 1, parseInt(e.target.value) || 1))} />
              </div>
            )}
          </div>

          {/* Transfer / logistics details (optional, useful for transfers) */}
          <div className="flex flex-wrap gap-3">
            <Input className="flex-1 min-w-[150px]" placeholder="Pickup location" value={line.pickup_location} onChange={e => set('pickup_location', e.target.value)} />
            <Input className="flex-1 min-w-[150px]" placeholder="Drop-off location" value={line.dropoff_location} onChange={e => set('dropoff_location', e.target.value)} />
            <Input className="w-36" placeholder="Flight no." value={line.flight_number} onChange={e => set('flight_number', e.target.value)} />
            <Input type="time" className="w-32" title="Time" value={line.service_time} onChange={e => set('service_time', e.target.value)} />
          </div>
          <Textarea rows={2} placeholder="Extra details for this service (optional)" value={line.details} onChange={e => set('details', e.target.value)} />

          <div className="flex items-center justify-between text-sm pt-1">
            <span className="text-slate-500">
              {sym(currency)}{line.unit_price.toFixed(2)} {line.unit?.replace('per_', '/ ')}
              {isNightly && nights > 0 ? ` · ${nights} night${nights !== 1 ? 's' : ''}` : ''}
            </span>
            <span className="font-semibold text-green-700">{sym(currency)}{lineTotal(line).toFixed(2)}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function ClientQuoteBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [client, setClient] = useState(/** @type {any} */ (null));
  const [clientLoaded, setClientLoaded] = useState(false);
  const [trip, setTrip] = useState({ title: '', destination: '', start_date: '', end_date: '', notes: '' });
  const [rooms, setRooms] = useState(() => [newRoom()]);
  const [lines, setLines] = useState(() => [newLine()]);

  useEffect(() => {
    db.auth.me().then(async (me) => {
      let resolved = null;
      if (me.client_id) resolved = await db.entities.Client.get(me.client_id).catch(() => null);
      if (!resolved && me.email) {
        const list = await db.entities.Client.filter({ email: me.email });
        resolved = list[0] || null;
      }
      setClient(resolved);
      setClientLoaded(true);
    }).catch(() => setClientLoaded(true));
  }, []);

  const currency = client?.preferred_currency || 'USD';

  const { data: storefront, isLoading: sfLoading } = /** @type {any} */ (useQuery({
    queryKey: ['b2bStorefront'],
    queryFn: getStorefront,
    enabled: !!client,
  }));
  const suppliers = storefront?.suppliers || [];

  // Rooms & passengers
  const setRoomOccupancy = (roomId, count) => {
    const typeMap = { 1: 'single', 2: 'double', 3: 'triple', 4: 'quad' };
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId) return r;
      const cur = r.passengers;
      let passengers;
      if (count > cur.length) passengers = [...cur, ...Array.from({ length: count - cur.length }, () => newPassenger())];
      else if (count < cur.length) passengers = cur.slice(0, count);
      else passengers = cur;
      return { ...r, type: typeMap[count] || 'double', passengers };
    }));
  };
  const addRoom = () => setRooms(prev => [...prev, newRoom()]);
  const removeRoom = (roomId) => setRooms(prev => (prev.length <= 1 ? prev : prev.filter(r => r.id !== roomId)));
  const updatePax = (roomId, paxId, updated) => setRooms(prev => prev.map(r => r.id === roomId ? { ...r, passengers: r.passengers.map(p => p.id === paxId ? updated : p) } : r));
  const setContact = (roomId, paxId) => setRooms(prev => prev.map(r => ({ ...r, passengers: r.passengers.map(p => ({ ...p, is_contact: r.id === roomId && p.id === paxId })) })));

  const allPassengers = rooms.flatMap(r => r.passengers.map(p => ({ ...p, room_id: r.id, room_type: r.type })));

  // Lines
  const addLine = () => setLines(prev => [...prev, newLine()]);
  const updateLine = (key, updated) => setLines(prev => prev.map(l => l._key === key ? updated : l));
  const removeLine = (key) => setLines(prev => (prev.length <= 1 ? [newLine()] : prev.filter(l => l._key !== key)));

  const validLines = lines.filter(l => l.pricing_id);
  const total = useMemo(() => validLines.reduce((sum, l) => sum + lineTotal(l), 0), [validLines]);

  const submitMutation = /** @type {any} */ (useMutation({
    mutationFn: () => submitQuote({
      title: trip.title || 'Quote request',
      destination: trip.destination,
      start_date: trip.start_date,
      end_date: trip.end_date,
      notes: trip.notes,
      passengers: allPassengers,
      items: validLines.map(l => ({
        pricing_id: l.pricing_id,
        quantity: l.quantity || 1,
        start_date: l.start_date || undefined,
        end_date: l.end_date || undefined,
        room_type: l.room_type || undefined,
        pickup_location: l.pickup_location || undefined,
        dropoff_location: l.dropoff_location || undefined,
        flight_number: l.flight_number || undefined,
        service_time: l.service_time || undefined,
        details: l.details || undefined,
      })),
    }),
    onSuccess: (quote) => {
      showSuccess('Quote request submitted');
      queryClient.invalidateQueries({ queryKey: ['myQuotes'] });
      navigate(createPageUrl(`ClientQuoteDetails?id=${quote.id}`));
    },
    onError: (error) => showError('Failed to submit quote request', error.message),
  }));

  if (!clientLoaded || (client && sfLoading)) return <SkeletonCard />;

  if (!client) {
    return (
      <Card className="max-w-md mx-auto p-8 text-center mt-10">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Account not ready</h2>
        <p className="text-slate-600">Your client account is being set up. Please contact your travel agent.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Request a Quote</h1>
        <p className="text-slate-500 mt-1 flex items-center gap-2">
          Build your trip and send it to us for pricing
          <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
            <ArrowRightLeft className="w-3 h-3" /> Prices in {currency}
          </span>
        </p>
      </div>

      {/* Trip details */}
      <Card className="p-6 bg-white shadow-md">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" />Trip Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Trip title</Label>
            <Input value={trip.title} onChange={e => setTrip({ ...trip, title: e.target.value })} placeholder="e.g. Summer in Cappadocia" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Destination</Label>
            <Input value={trip.destination} onChange={e => setTrip({ ...trip, destination: e.target.value })} placeholder="e.g. Istanbul & Cappadocia" />
          </div>
          <div className="space-y-2">
            <Label>Start date</Label>
            <Input type="date" value={trip.start_date} onChange={e => setTrip({ ...trip, start_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>End date</Label>
            <Input type="date" value={trip.end_date} onChange={e => setTrip({ ...trip, end_date: e.target.value })} />
          </div>
        </div>
      </Card>

      {/* Rooms & passengers */}
      <Card className="p-6 bg-white shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Users className="w-4 h-4 text-blue-600" />Rooms & Passengers</h2>
          <Button type="button" size="sm" variant="outline" onClick={addRoom}><Plus className="w-4 h-4 mr-1" />Add room</Button>
        </div>
        <div className="space-y-4">
          {rooms.map((room, ri) => (
            <div key={room.id} className="border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-700 text-sm">Room {ri + 1}</span>
                  <Select value={String(room.passengers.length)} onValueChange={v => setRoomOccupancy(room.id, parseInt(v))}>
                    <SelectTrigger className="w-32 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{[1, 2, 3, 4].map(n => <SelectItem key={n} value={String(n)}>{n} Person{n > 1 ? 's' : ''}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-red-500 hover:text-red-700" onClick={() => removeRoom(room.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="p-3 space-y-2">
                {room.passengers.map(pax => (
                  <PaxRow key={pax.id} pax={pax} onChange={u => updatePax(room.id, pax.id, u)} onSetContact={() => setContact(room.id, pax.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Services */}
      <Card className="p-6 bg-white shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Building className="w-4 h-4 text-blue-600" />Services</h2>
          <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="w-4 h-4 mr-1" />Add service</Button>
        </div>
        {suppliers.length === 0 ? (
          <p className="text-slate-500 text-center py-6">No suppliers are available in your portal yet. Please contact your travel agent.</p>
        ) : (
          <div className="space-y-4">
            {lines.map(line => (
              <ServiceLineCard key={line._key} line={line} suppliers={suppliers} currency={currency}
                onChange={u => updateLine(line._key, u)} onRemove={() => removeLine(line._key)} />
            ))}
          </div>
        )}
      </Card>

      {/* Notes + summary */}
      <Card className="p-6 bg-white shadow-md">
        <div className="space-y-2 mb-4">
          <Label>Notes (optional)</Label>
          <Textarea rows={3} value={trip.notes} onChange={e => setTrip({ ...trip, notes: e.target.value })} placeholder="Anything else we should know..." />
        </div>
        <Separator className="mb-4" />
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-bold text-slate-900">Estimated total</span>
          <span className="text-2xl font-bold text-green-700">{sym(currency)}{total.toFixed(2)}</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">This is an estimate in {currency}. Your final quote is confirmed by our team after review.</p>
        <Button className="w-full bg-blue-600 hover:bg-blue-700" disabled={validLines.length === 0 || submitMutation.isPending} onClick={() => submitMutation.mutate()}>
          {submitMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : <><Send className="w-4 h-4 mr-2" />Submit Quote Request</>}
        </Button>
      </Card>
    </div>
  );
}
