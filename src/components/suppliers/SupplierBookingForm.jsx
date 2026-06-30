const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Users, Loader2, CheckCircle } from 'lucide-react';

const MEAL_BASIS = [
  { value: 'RO', label: 'RO – Room Only' },
  { value: 'BB', label: 'BB – Bed & Breakfast' },
  { value: 'HB', label: 'HB – Half Board' },
  { value: 'FB', label: 'FB – Full Board' },
  { value: 'AI', label: 'AI – All Inclusive' },
  { value: 'UAI', label: 'UAI – Ultra All Inclusive' },
];

const TRANSFER_TYPES = [
  { value: 'airport_pickup', label: 'Airport Pick-up' },
  { value: 'airport_dropoff', label: 'Airport Drop-off' },
  { value: 'point_to_point', label: 'Point to Point' },
];

function isHotel(categoryName) {
  return categoryName?.toLowerCase().includes('hotel');
}
function isTransfer(categoryName) {
  return categoryName?.toLowerCase().includes('transfer');
}

export default function SupplierBookingForm({ open, onClose, onCreated, supplier, categoryName }) {
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState(null);
  const [form, setForm] = useState({
    service_date: '',
    num_people: 1,
    service_type: '',
    notes: '',
    total_cost: '',
    currency: 'EUR',
    pricing_id: '',
    pricing_name: '',
    // Transfer fields
    transfer_type: 'airport_pickup',
    origin_supplier_id: '',
    origin_supplier_name: '',
    destination_supplier_id: '',
    destination_supplier_name: '',
    pickup_location: '',
    dropoff_location: '',
    flight_number: '',
    flight_time: '',
    client_phone: '',
    // Hotel fields
    room_category: '',
    meal_basis: 'BB',
    num_nights: 1,
    check_in_date: '',
    check_out_date: '',
  });

  const { data: pricings = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['supplierPricings', supplier?.id],
    queryFn: () => db.entities.SupplierPricing.filter({ supplier_id: supplier.id }),
    enabled: !!supplier?.id && open
  }));

  const { data: subcategories = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['supplierSubcategories', supplier?.id],
    queryFn: () => db.entities.SupplierSubcategory.filter({ supplier_id: supplier.id }),
    enabled: !!supplier?.id && open
  }));

  const { data: allSuppliers = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['allSuppliers'],
    queryFn: () => db.entities.Supplier.list(),
    enabled: open
  }));

  useEffect(() => {
    if (open) { setSuccess(false); setForm(f => ({ ...f, service_date: '', num_people: 1, pricing_id: '', pricing_name: '',
      origin_supplier_id: '', origin_supplier_name: '', destination_supplier_id: '', destination_supplier_name: '',
      pickup_location: '', dropoff_location: '' })); }
  }, [open]);

  // Auto-set check_out from check_in + nights
  useEffect(() => {
    if (form.check_in_date && form.num_nights > 0) {
      const d = new Date(form.check_in_date);
      d.setDate(d.getDate() + Number(form.num_nights));
      const out = d.toISOString().split('T')[0];
      setForm(f => ({ ...f, check_out_date: out, service_date: form.check_in_date }));
    }
  }, [form.check_in_date, form.num_nights]);

  const createMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ data) => db.entities.SupplierBooking.create(data),
    onSuccess: (/** @type {any} */ created) => {
      queryClient.invalidateQueries({ queryKey: ['supplierBookings'] });
      setCreatedBookingId(created.id);
      if (onCreated) onCreated(created);
      setSuccess(true);
    }
  }));

  const selectedPricing = pricings.find(p => p.id === form.pricing_id);
  const getSubcatName = (id) => subcategories.find(s => s.id === id)?.name || '';

  // Auto-calculate total from pricing for hotels (rate × nights)
  useEffect(() => {
    if (selectedPricing && isHotel(categoryName) && form.num_nights > 0) {
      const total = selectedPricing.base_price * Number(form.num_nights);
      setForm(f => ({ ...f, total_cost: total.toFixed(2) }));
    }
  }, [form.pricing_id, form.num_nights, form.check_in_date]);

  const handlePricingSelect = (id) => {
    const p = pricings.find(x => x.id === id);
    setForm(f => ({
      ...f,
      pricing_id: id,
      pricing_name: p?.name || '',
      currency: p?.currency || f.currency,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      category_name: categoryName || '',
      ...form,
      num_people: Number(form.num_people),
      total_cost: form.total_cost ? Number(form.total_cost) : undefined,
      num_nights: form.num_nights ? Number(form.num_nights) : undefined,
    };
    // Clean up unused fields
    if (!isTransfer(categoryName)) {
      delete payload.transfer_type; delete payload.pickup_location;
      delete payload.dropoff_location; delete payload.flight_number;
      delete payload.flight_time; delete payload.client_phone;
      delete payload.origin_supplier_id; delete payload.origin_supplier_name;
      delete payload.destination_supplier_id; delete payload.destination_supplier_name;
    }
    if (!isHotel(categoryName)) {
      delete payload.room_category; delete payload.meal_basis;
      delete payload.num_nights; delete payload.check_in_date; delete payload.check_out_date;
    }
    createMutation.mutate(payload);
  };

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  if (success) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center py-8 gap-4 text-center">
            <CheckCircle className="w-16 h-16 text-green-500" />
            <h2 className="text-xl font-bold text-slate-900">Booking Submitted!</h2>
            <p className="text-slate-600">Your booking request for <strong>{supplier?.name}</strong> has been saved with status <Badge>Pending</Badge>.</p>
            <div className="flex gap-3 mt-2">
              {createdBookingId && (
                <Link to={createPageUrl(`SupplierBookingDetails?id=${createdBookingId}`)}>
                  <Button className="bg-blue-600 hover:bg-blue-700">View Details</Button>
                </Link>
              )}
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            Book: {supplier?.name}
            {categoryName && <Badge variant="outline" className="ml-2">{categoryName}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">

          {/* Common Fields */}
          <div className="grid grid-cols-2 gap-4">
            {!isHotel(categoryName) && (
              <div className="space-y-2">
                <Label>Service Date *</Label>
                <Input type="date" value={form.service_date} onChange={e => set('service_date', e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Number of People *</Label>
              <Input type="number" min={1} value={form.num_people} onChange={e => set('num_people', e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Service Type / Description *</Label>
            <Input value={form.service_type} onChange={e => set('service_type', e.target.value)} placeholder="e.g. Private Tour, Airport Transfer, Deluxe Room..." required />
          </div>

          {/* Pricing Selector */}
          {pricings.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Pricing Tier</Label>
                {Number(form.num_people) >= 12 && (
                  <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                    Group rate (12+ pax)
                  </Badge>
                )}
                {Number(form.num_people) < 12 && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    Individual rate
                  </Badge>
                )}
              </div>
              <Select value={form.pricing_id} onValueChange={handlePricingSelect}>
                <SelectTrigger><SelectValue placeholder="Choose a pricing option..." /></SelectTrigger>
                <SelectContent>
                  {pricings
                    .filter(p => p.is_active !== false)
                    .filter(p => {
                      const pType = p.pricing_type || 'individual';
                      if (Number(form.num_people) >= (p.min_group_size || 12)) return true;
                      if (Number(form.num_people) < 12) return pType === 'individual';
                      return pType === 'group';
                    })
                    .map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.currency} {p.base_price} / {p.unit?.replace('_', ' ')}
                      {p.subcategory_id ? ` (${getSubcatName(p.subcategory_id)})` : ''}
                      {(p.pricing_type || 'individual') === 'group' && ' [GROUP]'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPricing && (
                <p className="text-xs text-slate-500">{selectedPricing.description}</p>
              )}
            </div>
          )}

          {/* Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estimated Cost</Label>
              <Input type="number" step="0.01" value={form.total_cost} onChange={e => set('total_cost', e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => set('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['EUR','USD','GBP','TRY','CHF'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* TRANSFER-SPECIFIC FIELDS */}
          {isTransfer(categoryName) && (
            <div className="border rounded-lg p-4 space-y-4 bg-blue-50">
              <h3 className="font-semibold text-blue-900 text-sm">Transfer Details</h3>
              <div className="space-y-2">
                <Label>Transfer Type *</Label>
                <Select value={form.transfer_type} onValueChange={v => set('transfer_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRANSFER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Origin / Destination Supplier Selectors */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Origin</Label>
                  <Select value={form.origin_supplier_id} onValueChange={v => {
                    const s = allSuppliers.find(x => x.id === v);
                    setForm(f => ({ ...f, origin_supplier_id: v, origin_supplier_name: s?.name || '', pickup_location: s?.name || '' }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select a supplier..." /></SelectTrigger>
                    <SelectContent>
                      {allSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Destination</Label>
                  <Select value={form.destination_supplier_id} onValueChange={v => {
                    const s = allSuppliers.find(x => x.id === v);
                    setForm(f => ({ ...f, destination_supplier_id: v, destination_supplier_name: s?.name || '', dropoff_location: s?.name || '' }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select a supplier..." /></SelectTrigger>
                    <SelectContent>
                      {allSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Car capacity info */}
              {selectedPricing && selectedPricing.unit === 'per_car' && selectedPricing.car_capacity && (
                <div className="bg-white rounded p-3 text-sm border border-blue-200">
                  <span className="font-semibold">Car capacity:</span> up to {selectedPricing.car_capacity} pax per car
                  {Number(form.num_people) > 0 && (
                    <span className="ml-2">
                      → {Math.ceil(Number(form.num_people) / Number(selectedPricing.car_capacity))} car(s) needed for {form.num_people} pax
                    </span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    {form.transfer_type === 'airport_pickup' ? 'Pickup: Airport Name' :
                     form.transfer_type === 'airport_dropoff' ? 'Drop-off: Airport Name' : 'Pickup Location'}
                  </Label>
                  <Input value={form.pickup_location} onChange={e => set('pickup_location', e.target.value)}
                    placeholder={form.transfer_type?.includes('airport') ? 'e.g., Istanbul Sabiha' : 'e.g., Hotel lobby'} />
                </div>
                <div className="space-y-2">
                  <Label>
                    {form.transfer_type === 'airport_pickup' ? 'Drop-off Destination' :
                     form.transfer_type === 'airport_dropoff' ? 'Pickup Location' : 'Drop-off Location'}
                  </Label>
                  <Input value={form.dropoff_location} onChange={e => set('dropoff_location', e.target.value)}
                    placeholder="e.g., Hotel name / address" />
                </div>
              </div>
              {(form.transfer_type === 'airport_pickup' || form.transfer_type === 'airport_dropoff') && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Flight Number</Label>
                    <Input value={form.flight_number} onChange={e => set('flight_number', e.target.value)} placeholder="e.g., TK1234" />
                  </div>
                  <div className="space-y-2">
                    <Label>Flight Time</Label>
                    <Input type="time" value={form.flight_time} onChange={e => set('flight_time', e.target.value)} />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Client Phone Number</Label>
                <Input value={form.client_phone} onChange={e => set('client_phone', e.target.value)} placeholder="+90 555 000 0000" />
              </div>
            </div>
          )}

          {/* HOTEL-SPECIFIC FIELDS */}
          {isHotel(categoryName) && (
            <div className="border rounded-lg p-4 space-y-4 bg-green-50">
              <h3 className="font-semibold text-green-900 text-sm">Hotel Details</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Check-in Date *</Label>
                  <Input type="date" value={form.check_in_date} onChange={e => set('check_in_date', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Number of Nights *</Label>
                  <Input type="number" min={1} value={form.num_nights} onChange={e => set('num_nights', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Check-out Date</Label>
                  <Input type="date" value={form.check_out_date} readOnly className="bg-white cursor-not-allowed opacity-70" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Room Category</Label>
                  {subcategories.length > 0 ? (
                    <Select value={form.room_category} onValueChange={v => set('room_category', v)}>
                      <SelectTrigger><SelectValue placeholder="Select room type" /></SelectTrigger>
                      <SelectContent>
                        {subcategories.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={form.room_category} onChange={e => set('room_category', e.target.value)} placeholder="e.g., Standard, Deluxe, Suite" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Meal Basis *</Label>
                  <Select value={form.meal_basis} onValueChange={v => set('meal_basis', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MEAL_BASIS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Any special requests or details..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {createMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Submit Booking'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}