const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeletons';
import { ArrowLeft, CalendarDays, Users, Plane, Hotel, DollarSign, CheckCircle, Clock, XCircle, FileText, Loader2 } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';

const STATUS_STYLES = {
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  confirmed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle },
};

const MEAL_BASIS_LABELS = { RO: 'Room Only', BB: 'B&B', HB: 'Half Board', FB: 'Full Board', AI: 'All Inclusive', UAI: 'Ultra AI' };

export default function SupplierBookingDetails() {
  const [params] = useSearchParams();
  const bookingId = params.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: booking, isLoading } = useQuery({
    queryKey: ['supplierBooking', bookingId],
    queryFn: () => db.entities.SupplierBooking.get(bookingId),
    enabled: !!bookingId
  });

  const updateMutation = useMutation({
    mutationFn: ({ status }) => db.entities.SupplierBooking.update(bookingId, { status }),
    onSuccess: () => {
      showSuccess('Booking updated');
      queryClient.invalidateQueries({ queryKey: ['supplierBooking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['supplierBookings'] });
    },
    onError: (error) => showError('Failed to update booking', error.message)
  });

  if (isLoading) return <SkeletonCard />;
  if (!booking) return <div className="text-center py-20 text-slate-500">Booking not found.</div>;

  const { color, icon: StatusIcon } = STATUS_STYLES[booking.status] || STATUS_STYLES.pending;
  const isHotel = booking.category_name?.toLowerCase().includes('hotel');
  const isTransfer = booking.category_name?.toLowerCase().includes('transfer');

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('SupplierBookings')}>
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{booking.supplier_name}</h1>
            <p className="text-sm text-slate-500">Booking Details</p>
          </div>
        </div>
        <Badge className={`${color} text-sm px-3 py-1.5`}>
          <StatusIcon className="w-4 h-4 mr-1 inline" />
          {booking.status}
        </Badge>
      </div>

      <Card className="p-6 bg-white space-y-6">
        {/* Service Info */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Service Information
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Service Type</span>
              <p className="font-medium text-slate-900">{booking.service_type}</p>
            </div>
            <div>
              <span className="text-slate-500">Category</span>
              <p className="font-medium text-slate-900">{booking.category_name}</p>
            </div>
            <div>
              <span className="text-slate-500">Number of People</span>
              <p className="font-medium text-slate-900 flex items-center gap-1"><Users className="w-4 h-4 text-slate-400" /> {booking.num_people}</p>
            </div>
            {booking.pricing_name && (
              <div>
                <span className="text-slate-500">Rate Applied</span>
                <p className="font-medium text-slate-900">{booking.pricing_name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Date Info */}
        <div className="border-t pt-4">
          <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            Date & Schedule
          </h3>
          {isHotel && booking.check_in_date ? (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Check-in</span>
                <p className="font-medium">{booking.check_in_date}</p>
              </div>
              <div>
                <span className="text-slate-500">Check-out</span>
                <p className="font-medium">{booking.check_out_date}</p>
              </div>
              <div>
                <span className="text-slate-500">Nights</span>
                <p className="font-medium">{booking.num_nights}</p>
              </div>
            </div>
          ) : (
            <div className="text-sm">
              <span className="text-slate-500">Service Date</span>
              <p className="font-medium">{booking.service_date}</p>
            </div>
          )}
        </div>

        {/* Transfer Details */}
        {isTransfer && (
          <div className="border-t pt-4">
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Plane className="w-4 h-4 text-blue-600" />
              Transfer Details
            </h3>
            <div className="bg-blue-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-500">Type</span>
                  <p className="font-medium capitalize">{booking.transfer_type?.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <div>
                <span className="text-slate-500">From</span>
                <p className="font-medium">{booking.pickup_location}</p>
                {booking.origin_supplier_name && <p className="text-xs text-slate-400">Supplier: {booking.origin_supplier_name}</p>}
              </div>
              <div>
                <span className="text-slate-500">To</span>
                <p className="font-medium">{booking.dropoff_location}</p>
                {booking.destination_supplier_name && <p className="text-xs text-slate-400">Supplier: {booking.destination_supplier_name}</p>}
              </div>
              {booking.flight_number && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500">Flight</span>
                    <p className="font-medium">{booking.flight_number}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Time</span>
                    <p className="font-medium">{booking.flight_time}</p>
                  </div>
                </div>
              )}
              {booking.client_phone && (
                <div>
                  <span className="text-slate-500">Client Phone</span>
                  <p className="font-medium">{booking.client_phone}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hotel Details */}
        {isHotel && (
          <div className="border-t pt-4">
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Hotel className="w-4 h-4 text-green-600" />
              Room Details
            </h3>
            <div className="bg-green-50 rounded-lg p-4 text-sm space-y-2">
              <div className="grid grid-cols-2 gap-4">
                {booking.room_category && (
                  <div>
                    <span className="text-slate-500">Room Category</span>
                    <p className="font-medium">{booking.room_category}</p>
                  </div>
                )}
                {booking.meal_basis && (
                  <div>
                    <span className="text-slate-500">Meal Basis</span>
                    <p className="font-medium">{MEAL_BASIS_LABELS[booking.meal_basis] || booking.meal_basis}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cost */}
        {booking.total_cost != null && (
          <div className="border-t pt-4">
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              Cost
            </h3>
            <div className="text-lg font-bold text-green-700">{booking.currency} {Number(booking.total_cost).toFixed(2)}</div>
          </div>
        )}

        {/* Notes */}
        {booking.notes && (
          <div className="border-t pt-4">
            <h3 className="font-semibold text-slate-900 mb-2">Notes</h3>
            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{booking.notes}</p>
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {booking.status === 'pending' && (
          <>
            <Button onClick={() => updateMutation.mutate({ status: 'confirmed' })} className="bg-green-600 hover:bg-green-700" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              {updateMutation.isPending ? 'Saving...' : 'Confirm Booking'}
            </Button>
            <Button onClick={() => updateMutation.mutate({ status: 'cancelled' })} variant="outline" className="border-red-300 text-red-600" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
              {updateMutation.isPending ? 'Saving...' : 'Cancel Booking'}
            </Button>
          </>
        )}
        {booking.status === 'confirmed' && (
          <Button onClick={() => updateMutation.mutate({ status: 'cancelled' })} variant="outline" className="border-red-300 text-red-600" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
            {updateMutation.isPending ? 'Saving...' : 'Cancel Booking'}
          </Button>
        )}
        <Link to={createPageUrl('SupplierBookings')}>
          <Button variant="outline">Back to List</Button>
        </Link>
      </div>
    </div>
  );
}
