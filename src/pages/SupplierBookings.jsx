const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SkeletonTable } from '@/components/ui/skeletons';
import { CalendarDays, Users, Trash2, Search, Plane, Hotel, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';

const STATUS_STYLES = {
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  confirmed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle },
};

const MEAL_BASIS_LABELS = { RO: 'Room Only', BB: 'B&B', HB: 'Half Board', FB: 'Full Board', AI: 'All Inclusive', UAI: 'Ultra AI' };

export default function SupplierBookings() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['supplierBookings'],
    queryFn: () => db.entities.SupplierBooking.list('-created_date')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => db.entities.SupplierBooking.update(id, { status }),
    onSuccess: () => {
      showSuccess('Booking status updated');
      queryClient.invalidateQueries({ queryKey: ['supplierBookings'] });
    },
    onError: (error) => showError('Failed to update booking', error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.SupplierBooking.delete(id),
    onSuccess: () => {
      showSuccess('Booking deleted');
      queryClient.invalidateQueries({ queryKey: ['supplierBookings'] });
    },
    onError: (error) => showError('Failed to delete booking', error.message)
  });

  const filtered = bookings.filter(b => {
    const matchSearch = !search ||
      b.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.service_type?.toLowerCase().includes(search.toLowerCase()) ||
      b.category_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (isLoading) return <SkeletonTable />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-1">Supplier Bookings</h1>
          <p className="text-slate-600">All booking requests across suppliers</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input placeholder="Search by supplier, service..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Counts */}
      <div className="grid grid-cols-3 gap-4">
        {['pending','confirmed','cancelled'].map(s => {
          const count = bookings.filter(b => b.status === s).length;
          const { color } = STATUS_STYLES[s];
          return (
            <Card key={s} className="p-4 bg-white text-center">
              <div className={`text-2xl font-bold ${s === 'pending' ? 'text-yellow-600' : s === 'confirmed' ? 'text-green-600' : 'text-red-600'}`}>{count}</div>
              <div className="text-sm text-slate-500 capitalize mt-1">{s}</div>
            </Card>
          );
        })}
      </div>

      {/* Bookings List */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center bg-white">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No bookings found.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(booking => {
            const { color } = STATUS_STYLES[booking.status] || STATUS_STYLES.pending;
            const isHotelBooking = booking.category_name?.toLowerCase().includes('hotel');
            const isTransferBooking = booking.category_name?.toLowerCase().includes('transfer');
            return (
              <Link key={booking.id} to={createPageUrl(`SupplierBookingDetails?id=${booking.id}`)} className="block group">
              <Card className="p-5 bg-white hover:shadow-md transition-shadow group-hover:ring-1 group-hover:ring-blue-200">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-lg group-hover:text-blue-600 transition-colors">{booking.supplier_name}</span>
                      {booking.category_name && (
                        <Badge variant="outline" className="text-xs">{booking.category_name}</Badge>
                      )}
                      <Badge className={color}>{booking.status}</Badge>
                    </div>

                    <div className="text-slate-700 font-medium">{booking.service_type}</div>

                    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-4 h-4" />
                        {isHotelBooking && booking.check_in_date
                          ? `${booking.check_in_date} → ${booking.check_out_date} (${booking.num_nights} nights)`
                          : booking.service_date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {booking.num_people} {booking.num_people === 1 ? 'person' : 'people'}
                      </span>
                      {booking.total_cost && (
                        <span className="font-semibold text-green-700">{booking.currency} {booking.total_cost?.toFixed(2)}</span>
                      )}
                      {booking.pricing_name && (
                        <span className="text-blue-600 text-xs">Rate: {booking.pricing_name}</span>
                      )}
                    </div>

                    {/* Transfer Details */}
                    {isTransferBooking && (
                      <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
                        <div className="flex items-center gap-2 font-medium text-blue-800">
                          <Plane className="w-4 h-4" />
                          {booking.transfer_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </div>
                        <div className="text-slate-600">
                          <span className="font-medium">From:</span> {booking.pickup_location}
                          {' → '}
                          <span className="font-medium">To:</span> {booking.dropoff_location}
                        </div>
                        {booking.flight_number && (
                          <div className="text-slate-600">Flight: <strong>{booking.flight_number}</strong> at {booking.flight_time}</div>
                        )}
                        {booking.client_phone && <div className="text-slate-600">Client Phone: {booking.client_phone}</div>}
                      </div>
                    )}

                    {/* Hotel Details */}
                    {isHotelBooking && (
                      <div className="bg-green-50 rounded-lg p-3 text-sm space-y-1">
                        <div className="flex items-center gap-2 font-medium text-green-800">
                          <Hotel className="w-4 h-4" />
                          Hotel Booking
                        </div>
                        <div className="flex gap-4 text-slate-600">
                          {booking.room_category && <span>Room: <strong>{booking.room_category}</strong></span>}
                          {booking.meal_basis && <span>Basis: <strong>{MEAL_BASIS_LABELS[booking.meal_basis] || booking.meal_basis}</strong></span>}
                        </div>
                      </div>
                    )}

                    {booking.notes && <p className="text-sm text-slate-500 italic">{booking.notes}</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    {booking.status === 'pending' && (
                      <>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white w-full"
                          onClick={() => updateMutation.mutate({ id: booking.id, status: 'confirmed' })}
                          disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Confirm
                        </Button>
                        <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 w-full"
                          onClick={() => updateMutation.mutate({ id: booking.id, status: 'cancelled' })}
                          disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                          Cancel
                        </Button>
                      </>
                    )}
                    {booking.status === 'confirmed' && (
                      <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 w-full"
                        onClick={() => updateMutation.mutate({ id: booking.id, status: 'cancelled' })}
                        disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Cancel
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600 w-full"
                      onClick={() => deleteMutation.mutate(booking.id)}
                      disabled={deleteMutation.isPending}>
                      {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                      {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                    </Button>
                    </div>
                  </div>
                </Card>
                </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}