const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Send, CheckCircle, Clock, AlertCircle, Plus, Mail } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BookingRequestEmail from './BookingRequestEmail';

const SERVICE_BOOKING_STATUS = {
  not_requested: { label: 'Not Requested', color: 'bg-slate-100 text-slate-800', icon: AlertCircle },
  requested: { label: 'Requested', color: 'bg-blue-100 text-blue-800', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
};

export default function ServiceBookingManager({ trip, user, suppliers, appSettings }) {
  const queryClient = useQueryClient();
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedServiceIdx, setSelectedServiceIdx] = useState(null);
  const [supplierEmail, setSupplierEmail] = useState('');
  const [bookingNote, setBookingNote] = useState('');
  const [supplierChoice, setSupplierChoice] = useState('existing'); // 'existing' or 'manual'
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [createSupplierOpen, setCreateSupplierOpen] = useState(false);
  const [newSupplierData, setNewSupplierData] = useState({ name: '', email: '', phone: '' });


  const sendBookingMutation = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ { serviceIdx, /** @type {any} */ email, /** @type {any} */ note, /** @type {any} */ newSupplierName }) => {
      const service = trip.services[serviceIdx];
      const emailBody = buildBookingEmailBody(trip, service, note);
      
      await db.integrations.Core.SendEmail({
        to: email,
        subject: `Booking Request: ${service.name} - ${trip.name}`,
        body: emailBody
      });

      // Update service booking status
      const updatedServices = [...trip.services];
      updatedServices[serviceIdx] = {
        ...updatedServices[serviceIdx],
        booking_status: 'requested',
        booking_requested_email: email,
        booking_requested_date: new Date().toISOString(),
        booking_requested_by: user?.email,
        booking_note: note,
        requested_supplier_name: newSupplierName || null
      };

      return db.entities.Trip.update(trip.id, { services: updatedServices });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', trip.id] });
      setBookingModalOpen(false);
      setSupplierEmail('');
      setBookingNote('');
      setSupplierChoice('existing');
      setSelectedServiceIdx(null);
    }
  }));

  const confirmServiceMutation = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ serviceIdx) => {
      const updatedServices = [...trip.services];
      updatedServices[serviceIdx] = {
        ...updatedServices[serviceIdx],
        booking_status: 'confirmed',
        booking_confirmed_date: new Date().toISOString(),
        booking_confirmed_by: user?.email
      };
      return db.entities.Trip.update(trip.id, { services: updatedServices });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trip', trip.id] })
  }));

  const createSupplierMutation = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ data) => {
      const newSupplier = await db.entities.Supplier.create({
        name: data.name,
        email: data.email,
        phone: data.phone,
        category_id: 'general'
      });
      return newSupplier;
    },
    onSuccess: (newSupplier) => {
      setSelectedSupplierId(newSupplier.id);
      setNewSupplierEmail(newSupplier.email);
      setCreateSupplierOpen(false);
      setNewSupplierData({ name: '', email: '', phone: '' });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    }
  }));

  const openBookingModal = (serviceIdx) => {
    const service = trip.services[serviceIdx];
    const supplierInfo = service.supplier_id ? suppliers.find(s => s.id === service.supplier_id) : null;
    
    setSelectedServiceIdx(serviceIdx);
    setSupplierEmail(supplierInfo?.email || '');
    setSelectedSupplierId(service.supplier_id || '');
    setSupplierChoice(supplierInfo ? 'existing' : 'manual');
    setBookingNote('');
    setBookingModalOpen(true);
  };

  if (!trip.services || trip.services.length === 0) {
    return null;
  }

  const isConfirmed = trip.proposal_status === 'confirmed';

  return (
    <>
      <Card className="p-6 bg-white shadow-lg print:shadow-none">
        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Mail className="w-5 h-5 text-purple-600" />
          Supplier Booking Management
        </h2>

        {!isConfirmed && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">Confirm the reservation first to send booking requests to suppliers.</p>
          </div>
        )}

        <div className="space-y-4">
          {(trip.services || []).slice().sort((a, b) => {
            const aStart = a.start_date || ''; const bStart = b.start_date || '';
            if (aStart < bStart) return -1; if (aStart > bStart) return 1;
            const aEnd = a.end_date || ''; const bEnd = b.end_date || '';
            if (aEnd < bEnd) return -1; if (aEnd > bEnd) return 1;
            return (a.name || '').localeCompare(b.name || '');
          }).map((service) => {
            const idx = trip.services.indexOf(service);
            const status = service.booking_status || 'not_requested';
            const statusConfig = SERVICE_BOOKING_STATUS[status];
            const StatusIcon = statusConfig.icon;
            const supplierName = service.supplier_id ? (suppliers.find(s => s.id === service.supplier_id)?.name || '—') : service.requested_supplier_name || '—';

            return (
              <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{service.name}</h3>
                    <p className="text-sm text-slate-600">{supplierName}</p>
                  </div>
                  <Badge className={`${statusConfig.color} flex items-center gap-1.5 flex-shrink-0`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusConfig.label}
                  </Badge>
                </div>

                {service.booking_status && (
                  <div className="text-xs text-slate-500 space-y-0.5 mb-3">
                    {service.booking_requested_date && (
                      <p>Requested {new Date(service.booking_requested_date).toLocaleDateString()} to {service.booking_requested_email}</p>
                    )}
                    {service.booking_note && (
                      <div className="mt-2 p-2 bg-white rounded border border-slate-200 text-slate-700">{service.booking_note}</div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {status === 'not_requested' && isConfirmed && (
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700"
                      onClick={() => openBookingModal(idx)}
                    >
                      <Send className="w-3.5 h-3.5 mr-1" />Send to Supplier
                    </Button>
                  )}
                  {status === 'requested' && isConfirmed && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-purple-300 text-purple-600 hover:bg-purple-50"
                        onClick={() => openBookingModal(idx)}
                      >
                        <Send className="w-3.5 h-3.5 mr-1" />Resend
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => confirmServiceMutation.mutate(idx)}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />Mark Confirmed
                      </Button>
                    </>
                  )}
                  {status === 'not_requested' && isConfirmed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-300 text-green-600 hover:bg-green-50"
                      onClick={() => confirmServiceMutation.mutate(idx)}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />Mark Confirmed (No Email)
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Booking Request Modal */}
      <Dialog open={bookingModalOpen} onOpenChange={setBookingModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Booking Request to Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Service</Label>
              <div className="p-2 bg-slate-50 rounded border text-sm font-medium text-slate-900">
                {selectedServiceIdx !== null && trip.services[selectedServiceIdx]?.name}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Send To</Label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="radio"
                  id="existing"
                  name="supplier"
                  value="existing"
                  checked={supplierChoice === 'existing'}
                  onChange={() => setSupplierChoice('existing')}
                />
                <label htmlFor="existing" className="text-sm cursor-pointer">Existing Supplier</label>
              </div>
              {supplierChoice === 'existing' && (
                <div className="space-y-2">
                  <Select value={selectedSupplierId} onValueChange={(val) => {
                    setSelectedSupplierId(val);
                    const supplier = suppliers.find(s => s.id === val);
                    setSupplierEmail(supplier?.email || '');
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedSupplierId && (
                    <div className="text-xs text-slate-500 p-2 bg-slate-50 rounded">{supplierEmail}</div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 mt-3">
                <input
                  type="radio"
                  id="manual"
                  name="supplier"
                  value="manual"
                  checked={supplierChoice === 'manual'}
                  onChange={() => setSupplierChoice('manual')}
                />
                <label htmlFor="manual" className="text-sm cursor-pointer">Manual Email</label>
              </div>
              {supplierChoice === 'manual' && (
                <Input
                  type="email"
                  placeholder="Supplier email address"
                  value={newSupplierEmail}
                  onChange={(e) => setNewSupplierEmail(e.target.value)}
                />
              )}

              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2 text-blue-600 hover:bg-blue-50"
                onClick={() => setCreateSupplierOpen(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />Create New Supplier
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Booking Note</Label>
              <Textarea
                placeholder="Add specific requirements or details for this booking..."
                value={bookingNote}
                onChange={(e) => setBookingNote(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setBookingModalOpen(false)}>Cancel</Button>
              <Button
                className="bg-purple-600 hover:bg-purple-700"
                onClick={() => {
                  setPreviewModalOpen(true);
                  setBookingModalOpen(false);
                }}
                disabled={!supplierEmail && !newSupplierEmail}
              >
                <Send className="w-4 h-4 mr-2" />Preview & Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Request Email Preview */}
      {selectedServiceIdx !== null && (
        <BookingRequestEmail
          open={previewModalOpen}
          onOpenChange={setPreviewModalOpen}
          trip={trip}
          service={trip.services[selectedServiceIdx]}
          note={bookingNote}
          appSettings={appSettings}
          user={user}
          onConfirmSend={() => {
            const email = supplierChoice === 'existing' ? supplierEmail : newSupplierEmail;
            const supplierName = supplierChoice === 'existing' 
              ? suppliers.find(s => s.id === selectedSupplierId)?.name 
              : null;
            sendBookingMutation.mutate({ serviceIdx: selectedServiceIdx, email, note: bookingNote, newSupplierName: supplierName });
            setPreviewModalOpen(false);
          }}
        />
      )}

      {/* Create Supplier Modal */}
      <Dialog open={createSupplierOpen} onOpenChange={setCreateSupplierOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Supplier Name</Label>
              <Input
                placeholder="e.g., Hotel XYZ"
                value={newSupplierData.name}
                onChange={(e) => setNewSupplierData({ ...newSupplierData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="supplier@example.com"
                value={newSupplierData.email}
                onChange={(e) => setNewSupplierData({ ...newSupplierData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone (Optional)</Label>
              <Input
                placeholder="+1 (555) 123-4567"
                value={newSupplierData.phone}
                onChange={(e) => setNewSupplierData({ ...newSupplierData, phone: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateSupplierOpen(false)}>Cancel</Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => createSupplierMutation.mutate(newSupplierData)}
                disabled={!newSupplierData.name || !newSupplierData.email}
              >
                Create & Use
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function buildRoomingBreakdown(passengers) {
  if (!passengers?.length) return 'TBD';
  const rooms = {};
  for (const p of passengers) {
    const key = p.room_id || 'unassigned';
    if (!rooms[key]) rooms[key] = { type: p.room_type || 'unassigned', occupants: [] };
    rooms[key].occupants.push(p.name);
  }
  const lines = Object.values(rooms).map(r => {
    const label = r.type.charAt(0).toUpperCase() + r.type.slice(1);
    return `  - 1 x ${label} Room: ${r.occupants.join(', ')}`;
  });
  return `${passengers.length} pax\nROOMING:\n${lines.join('\n')}`;
}

function buildBookingEmailBody(trip, service, note) {
  const sc = ({ USD: '$', EUR: '€', GBP: '£', TRY: '₺' }[trip.selling_currency] || trip.selling_currency);
  const quantity = parseInt(service.quantity) || 1;
  const total = (parseFloat(service.acquiring_price) || 0) * quantity;
  const paxInfo = buildRoomingBreakdown(trip.passengers);

  return `Hello,\n\nWe would like to request a booking for the following service:\n\n` +
    `SERVICE: ${service.name}\n` +
    `TRIP: ${trip.name}\n` +
    `DESTINATION: ${trip.destination}\n` +
    `DATES: ${trip.start_date} to ${trip.end_date}\n` +
    `QUANTITY: ${quantity}\n` +
    `UNIT PRICE: ${sc}${(parseFloat(service.acquiring_price) || 0).toFixed(2)}\n` +
    `TOTAL: ${sc}${total.toFixed(2)}\n` +
    (service.description ? `DESCRIPTION: ${service.description}\n` : '') +
    `PASSENGERS: ${paxInfo}\n\n` +
    (note ? `SPECIAL REQUESTS/NOTES:\n${note}\n\n` : '') +
    `Please confirm the availability and send us the booking confirmation at your earliest convenience.\n\n` +
    `Thank you,\n${trip.client_name || 'Travel Agency'}`;
}