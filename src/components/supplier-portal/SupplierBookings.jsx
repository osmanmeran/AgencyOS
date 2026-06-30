const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  CheckCircle, XCircle, Clock, FileText, 
  Calendar, Users, DollarSign, Download, Mail
} from 'lucide-react';
import { format } from 'date-fns';
import BookingEmailSender from '../booking/BookingEmailSender';

const STATUS_COLORS = {
  pending: 'bg-orange-100 text-orange-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-800',
  completed: 'bg-blue-100 text-blue-800'
};

export default function SupplierBookings({ supplierId }) {
  const queryClient = useQueryClient();
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [confirmationFile, setConfirmationFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [bookingForEmail, setBookingForEmail] = useState(null);

  const { data: supplier } = /** @type {any} */ (useQuery({
    queryKey: ['supplier', supplierId],
    queryFn: () => db.entities.Supplier.get(supplierId),
    enabled: !!supplierId
  }));

  const { data: bookings = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['supplierBookings', supplierId],
    queryFn: () => db.entities.BookingRequest.filter({ supplier_id: supplierId }, '-created_date'),
    enabled: !!supplierId
  }));

  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['trips'],
    queryFn: () => db.entities.Trip.list()
  }));

  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['clients'],
    queryFn: () => db.entities.Client.list()
  }));

  const updateMutation = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ { id, /** @type {any} */ data }) => {
      let fileUrl = data.confirmation_file_url;
      if (confirmationFile) {
        const { file_url } = await db.integrations.Core.UploadFile({ file: confirmationFile });
        fileUrl = file_url;
      }
      return db.entities.BookingRequest.update(id, { ...data, confirmation_file_url: fileUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierBookings', supplierId] });
      setSelectedBooking(null);
      setConfirmationFile(null);
      setNotes('');
      setIsConfirmed(false);
    }
  }));

  const handleConfirm = () => {
    updateMutation.mutate({
      id: selectedBooking.id,
      data: {
        ...selectedBooking,
        status: 'confirmed',
        supplier_confirmed: isConfirmed,
        supplier_notes: notes
      }
    });
  };

  const handleReject = () => {
    updateMutation.mutate({
      id: selectedBooking.id,
      data: {
        ...selectedBooking,
        status: 'rejected',
        supplier_notes: notes
      }
    });
  };

  const getTrip = (id) => trips.find(t => t.id === id);
  const getClient = (id) => clients.find(c => c.id === id);

  const generateBookingHTML = (booking) => {
    const trip = getTrip(booking.trip_id);
    const client = getClient(booking.client_id);
    return `
<!DOCTYPE html>
<html>
<head><title>Booking Request - ${booking.reference_number}</title>
<style>
body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
.header { background: #2563eb; color: white; padding: 20px; border-radius: 8px; }
.details { background: #f1f5f9; padding: 20px; margin: 20px 0; border-radius: 8px; }
.row { display: flex; justify-content: space-between; margin: 10px 0; }
</style>
</head>
<body>
<div class="header">
<h1>Booking Request</h1>
<p>Reference: ${booking.reference_number || 'N/A'}</p>
</div>
<div class="details">
<div class="row"><strong>Service Date:</strong><span>${booking.service_date}</span></div>
<div class="row"><strong>Number of Guests:</strong><span>${booking.num_guests}</span></div>
<div class="row"><strong>Trip:</strong><span>${trip?.name || 'N/A'}</span></div>
<div class="row"><strong>Client:</strong><span>${client?.name || 'N/A'}</span></div>
<div class="row"><strong>Total Cost:</strong><span>$${booking.total_cost?.toFixed(2) || '0.00'}</span></div>
</div>
<div class="details">
<h3>Service Details</h3>
<p>${booking.service_details || 'No additional details'}</p>
</div>
</body>
</html>`;
  };

  const downloadBookingRequest = (booking) => {
    const html = generateBookingHTML(booking);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-${booking.reference_number || booking.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {bookings.length === 0 ? (
        <Card className="p-12 text-center">
          <Clock className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No booking requests</h3>
          <p className="text-slate-600">You'll see booking requests here when they arrive</p>
        </Card>
      ) : (
        bookings.map(booking => {
          const trip = getTrip(booking.trip_id);
//           const client = getClient(booking.client_id);
          return (
            <Card key={booking.id} className="p-6 bg-white">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-slate-900">
                      {booking.reference_number || `Booking #${booking.id.slice(-6)}`}
                    </h3>
                    <Badge className={STATUS_COLORS[booking.status]}>{booking.status}</Badge>
                  </div>
                  <p className="text-slate-600 text-sm">{trip?.name || 'Trip details unavailable'}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    setBookingForEmail(booking);
                    setEmailModalOpen(true);
                  }}>
                    <Mail className="w-4 h-4 mr-1" /> Email
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadBookingRequest(booking)}>
                    <Download className="w-4 h-4 mr-1" /> Export
                  </Button>
                  {booking.status === 'pending' && (
                    <Button size="sm" onClick={() => {
                      setSelectedBooking(booking);
                      setNotes(booking.supplier_notes || '');
                      setIsConfirmed(booking.supplier_confirmed || false);
                    }}>
                      Respond
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>{format(new Date(booking.service_date), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>{booking.num_guests} guests</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  <span>${booking.total_cost?.toFixed(2) || '0.00'}</span>
                </div>
                {booking.supplier_confirmed && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirmed</span>
                  </div>
                )}
              </div>

              {booking.confirmation_file_url && (
                <div className="mt-3 pt-3 border-t">
                  <a href={booking.confirmation_file_url} target="_blank" rel="noopener noreferrer" 
                     className="text-blue-600 hover:underline flex items-center gap-1 text-sm">
                    <FileText className="w-4 h-4" /> View Confirmation Letter
                  </a>
                </div>
              )}
            </Card>
          );
        })
      )}

      {/* Email Sender Modal */}
      {bookingForEmail && (
        <BookingEmailSender
          open={emailModalOpen}
          onClose={() => { setEmailModalOpen(false); setBookingForEmail(null); }}
          booking={bookingForEmail}
          supplier={supplier}
          trip={getTrip(bookingForEmail.trip_id)}
          client={getClient(bookingForEmail.client_id)}
        />
      )}

      {/* Response Modal */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to Booking Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="confirm" 
                checked={isConfirmed} 
                onCheckedChange={setIsConfirmed}
              />
              <Label htmlFor="confirm" className="font-medium">
                I confirm this booking is available and accepted
              </Label>
            </div>

            <div className="space-y-2">
              <Label>Upload Confirmation Letter (PDF)</Label>
              <Input 
                type="file" 
                accept=".pdf,.doc,.docx"
                onChange={(e) => setConfirmationFile(e.target.files[0])}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes for Agent</Label>
              <Textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleConfirm}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={!isConfirmed}
              >
                <CheckCircle className="w-4 h-4 mr-2" /> Confirm Booking
              </Button>
              <Button 
                onClick={handleReject}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className="w-4 h-4 mr-2" /> Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}