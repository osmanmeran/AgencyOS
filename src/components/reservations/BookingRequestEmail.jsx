import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Send, Download, X } from 'lucide-react';
import { format } from 'date-fns';

const currSymbol = (cur) => ({ USD: '$', EUR: '€', GBP: '£', TRY: '₺', AED: 'د.إ', SAR: '﷼', EGP: 'E£', MAD: 'MAD', JPY: '¥', CHF: 'CHF', CAD: 'CA$', AUD: 'A$' }[cur] || cur);

export default function BookingRequestEmail({ open, onOpenChange, trip, service, note, appSettings, user, onConfirmSend }) {
  const sc = currSymbol(trip.selling_currency || 'USD');
  const quantity = parseInt(service.quantity) || 1;
  const total = (parseFloat(service.acquiring_price) || 0) * quantity;
  const senderInfo = appSettings?.invoice_header || {};
  const contactPassenger = trip.passengers?.find(p => p.is_contact);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <DialogTitle>Booking Request Preview</DialogTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Download className="w-4 h-4 mr-1" />Print/PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="p-8 bg-white text-sm print:p-0 print:text-xs space-y-6">
          {/* Company Header */}
          <div className="border-b-2 border-slate-200 pb-6">
            <div className="flex justify-between items-start">
              <div>
                {senderInfo.logo_url && (
                  <img src={senderInfo.logo_url} alt="Company Logo" className="h-16 mb-3" />
                )}
                <h1 className="text-2xl font-bold text-slate-900">{senderInfo.company_name || 'Travel Agency'}</h1>
                <div className="text-slate-600 text-xs mt-2 space-y-0.5">
                  {senderInfo.address_line1 && <p>{senderInfo.address_line1}</p>}
                  {senderInfo.address_line2 && <p>{senderInfo.address_line2}</p>}
                  {(senderInfo.city || senderInfo.postal_code) && (
                    <p>{senderInfo.city} {senderInfo.postal_code}</p>
                  )}
                  {senderInfo.country && <p>{senderInfo.country}</p>}
                  {senderInfo.phone && <p>T: {senderInfo.phone}</p>}
                  {senderInfo.email && <p>E: {senderInfo.email}</p>}
                  {senderInfo.tax_id && <p>Tax ID: {senderInfo.tax_id}</p>}
                </div>
              </div>
              <div className="text-right">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-1">BOOKING REQUEST</p>
                  <p className="font-bold text-slate-900">{trip.reference_number || 'Pending'}</p>
                  <p className="text-xs text-slate-600">{format(new Date(), 'MMM d, yyyy')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Trip & Client Info */}
          <div className="grid grid-cols-2 gap-8">
            {/* Trip Details */}
            <div>
              <h3 className="font-bold text-slate-900 mb-3 uppercase text-xs tracking-wide">Trip Details</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-slate-500 text-xs">Trip Name</p>
                  <p className="font-semibold text-slate-900">{trip.name}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Destination</p>
                  <p className="font-semibold text-slate-900">{trip.destination}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Travel Dates</p>
                  <p className="font-semibold text-slate-900">{format(new Date(trip.start_date), 'MMM d')} – {format(new Date(trip.end_date), 'MMM d, yyyy')}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Passengers</p>
                  <p className="font-semibold text-slate-900">{trip.passengers?.length || 0}</p>
                </div>
              </div>
            </div>

            {/* Client Details */}
            <div>
              <h3 className="font-bold text-slate-900 mb-3 uppercase text-xs tracking-wide">Client Details</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-slate-500 text-xs">Client Name</p>
                  <p className="font-semibold text-slate-900">{trip.client_name || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Email</p>
                  <p className="font-semibold text-slate-900 break-all">{trip.client_email || '—'}</p>
                </div>
                {contactPassenger && (
                  <div>
                    <p className="text-slate-500 text-xs">Contact Person</p>
                    <p className="font-semibold text-slate-900">{contactPassenger.name}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Service Details */}
          <div className="border border-slate-200 rounded-lg p-6 bg-slate-50">
            <h3 className="font-bold text-slate-900 mb-4 uppercase text-xs tracking-wide">Service Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Service Name</span>
                <span className="font-bold text-slate-900">{service.name}</span>
              </div>
              {service.description && (
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Description</span>
                  <span className="text-slate-900 text-right max-w-xs">{service.description}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Quantity</span>
                <span className="font-bold text-slate-900">{quantity}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-slate-200">
                <span className="text-slate-600 font-medium">Unit Price</span>
                <span className="font-bold text-slate-900">{sc}{(parseFloat(service.acquiring_price) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="font-bold text-slate-900">Total Amount</span>
                <span className="font-bold text-green-700">{sc}{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Passenger List & Rooming */}
          {trip.passengers?.length > 0 && (
            <div>
              <h3 className="font-bold text-slate-900 mb-3 uppercase text-xs tracking-wide">Passenger List & Rooming</h3>
              {(() => {
                const rooms = {};
                for (const p of trip.passengers) {
                  const key = p.room_id || 'unassigned';
                  if (!rooms[key]) rooms[key] = { id: key, type: p.room_type || 'unassigned', occupants: [] };
                  rooms[key].occupants.push(p);
                }
                const roomList = Object.values(rooms);
                const typeLabels = { single: 'Single Room', double: 'Double Room', triple: 'Triple Room', quad: 'Quad Room' };
                return (
                  <div className="space-y-2">
                    {roomList.map(room => (
                      <div key={room.id} className="border border-slate-200 rounded-lg p-3 bg-white">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                            1 x {typeLabels[room.type] || room.type}
                          </span>
                          <span className="text-xs text-slate-500">({room.occupants.length} pax)</span>
                        </div>
                        <ul className="text-xs text-slate-700 space-y-0.5 ml-2">
                          {room.occupants.map(p => (
                            <li key={p.id}>• {p.name}{p.is_contact ? ' (Contact)' : ''}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Special Requests */}
          {note && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-bold text-slate-900 mb-2 uppercase text-xs tracking-wide">Special Requests / Notes</h3>
              <p className="text-slate-700 text-xs whitespace-pre-wrap">{note}</p>
            </div>
          )}

          {/* Booking Terms */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-slate-700 mb-2">
              We request your confirmation of availability for the above service. Please provide:
            </p>
            <ul className="text-xs text-slate-700 space-y-1 ml-4">
              <li>• Final confirmation of availability</li>
              <li>• Any specific requirements or restrictions</li>
              <li>• Cancellation policy</li>
              <li>• Invoice with final pricing</li>
            </ul>
          </div>

          {/* Bank Details Footer */}
          {senderInfo.bank_details && (
            <div className="border-t-2 border-slate-200 pt-6 text-xs">
              <h3 className="font-bold text-slate-900 mb-2">PAYMENT INFORMATION</h3>
              <div className="bg-slate-50 p-3 rounded text-slate-700 whitespace-pre-wrap">
                {senderInfo.bank_details}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-slate-200 pt-4 text-xs text-slate-600 text-center">
            <p>This is a booking request for service confirmation.</p>
            <p>Prepared by: {user?.full_name || user?.email}</p>
            <p>Date: {format(new Date(), 'MMM d, yyyy')}</p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t p-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-purple-600 hover:bg-purple-700" onClick={onConfirmSend}>
            <Send className="w-4 h-4 mr-2" />Send Booking Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}