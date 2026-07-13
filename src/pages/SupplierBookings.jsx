import { db } from '@/lib/DbContext';

import { useState } from 'react';
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
import { useT } from '@/lib/i18n/I18nContext';

const STATUS_STYLES = {
  pending: { color: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300', icon: Clock },
  confirmed: { color: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300', icon: CheckCircle },
  cancelled: { color: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300', icon: XCircle },
};

export default function SupplierBookings() {
  const { t } = useT();
  const MEAL_BASIS_LABELS = {
    RO: t('supplierBookings.mealRO'),
    BB: t('supplierBookings.mealBB'),
    HB: t('supplierBookings.mealHB'),
    FB: t('supplierBookings.mealFB'),
    AI: t('supplierBookings.mealAI'),
    UAI: t('supplierBookings.mealUAI'),
  };
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  // Default to "active" so cancelled/rejected bookings are hidden; users can
  // switch to "All Status" (or a specific status) to see everything.
  const [statusFilter, setStatusFilter] = useState('active');
  const ACTIVE_STATUSES = ['pending', 'confirmed'];

  const { data: bookings = /** @type {any} */ ([]), isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierBookings'],
      queryFn: () => db.entities.SupplierBooking.list('-created_date'),
    })
  );

  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, /** @type {any} */ status }) =>
        db.entities.SupplierBooking.update(id, { status }),
      onSuccess: () => {
        showSuccess(t('supplierBookings.updateSuccess'));
        queryClient.invalidateQueries({ queryKey: ['supplierBookings'] });
      },
      onError: (error) => showError(t('supplierBookings.updateError'), error.message),
    })
  );

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.SupplierBooking.delete(id),
      onSuccess: () => {
        showSuccess(t('supplierBookings.deleteSuccess'));
        queryClient.invalidateQueries({ queryKey: ['supplierBookings'] });
      },
      onError: (error) => showError(t('supplierBookings.deleteError'), error.message),
    })
  );

  const filtered = bookings.filter((b) => {
    const matchSearch =
      !search ||
      b.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.service_type?.toLowerCase().includes(search.toLowerCase()) ||
      b.category_name?.toLowerCase().includes(search.toLowerCase());
    const effectiveStatus = b.status || 'pending';
    const matchStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
          ? ACTIVE_STATUSES.includes(effectiveStatus)
          : effectiveStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  if (isLoading) return <SkeletonTable />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-1">{t('supplierBookings.title')}</h1>
          <p className="text-muted-foreground">{t('supplierBookings.subtitle')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={t('supplierBookings.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t('common.active')}</SelectItem>
            <SelectItem value="all">{t('supplierBookings.allStatus')}</SelectItem>
            <SelectItem value="pending">{t('common.pending')}</SelectItem>
            <SelectItem value="confirmed">{t('common.confirmed')}</SelectItem>
            <SelectItem value="cancelled">{t('common.cancelled')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Counts */}
      <div className="grid grid-cols-3 gap-4">
        {['pending', 'confirmed', 'cancelled'].map((s) => {
          const count = bookings.filter((b) => b.status === s).length;
          return (
            <Card key={s} className="p-4 bg-card text-center">
              <div
                className={`text-2xl font-bold ${s === 'pending' ? 'text-yellow-600 dark:text-yellow-300' : s === 'confirmed' ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}
              >
                {count}
              </div>
              <div className="text-sm text-muted-foreground capitalize mt-1">{t(`common.${s}`)}</div>
            </Card>
          );
        })}
      </div>

      {/* Bookings List */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center bg-card">
          <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t('supplierBookings.noBookingsFound')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((booking) => {
            const { color } = STATUS_STYLES[booking.status] || STATUS_STYLES.pending;
            const isHotelBooking = booking.category_name?.toLowerCase().includes('hotel');
            const isTransferBooking = booking.category_name?.toLowerCase().includes('transfer');
            return (
              <Link
                key={booking.id}
                to={createPageUrl(`SupplierBookingDetails?id=${booking.id}`)}
                className="block group"
              >
                <Card className="p-5 bg-card hover:shadow-md transition-shadow group-hover:ring-1 group-hover:ring-blue-200">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground text-lg group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
                          {booking.supplier_name}
                        </span>
                        {booking.category_name && (
                          <Badge variant="outline" className="text-xs">
                            {booking.category_name}
                          </Badge>
                        )}
                        <Badge className={color}>{t(`common.${booking.status}`)}</Badge>
                      </div>

                      <div className="text-foreground font-medium">{booking.service_type}</div>

                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-4 h-4" />
                          {isHotelBooking && booking.check_in_date
                            ? `${booking.check_in_date} → ${booking.check_out_date} (${booking.num_nights} nights)`
                            : booking.service_date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {t(
                            booking.num_people === 1
                              ? 'supplierBookings.personSingular'
                              : 'supplierBookings.personPlural',
                            { count: booking.num_people },
                          )}
                        </span>
                        {booking.total_cost && (
                          <span className="font-semibold text-green-700 dark:text-green-300">
                            {booking.currency} {booking.total_cost?.toFixed(2)}
                          </span>
                        )}
                        {booking.pricing_name && (
                          <span className="text-blue-600 dark:text-blue-300 text-xs">
                            {t('supplierBookings.rateLabel', { name: booking.pricing_name })}
                          </span>
                        )}
                      </div>

                      {/* Transfer Details */}
                      {isTransferBooking && (
                        <div className="bg-blue-50 dark:bg-blue-950/40 rounded-lg p-3 text-sm space-y-1">
                          <div className="flex items-center gap-2 font-medium text-blue-800 dark:text-blue-300">
                            <Plane className="w-4 h-4" />
                            {booking.transfer_type?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </div>
                          <div className="text-muted-foreground">
                            <span className="font-medium">{t('supplierBookings.fromLabel')}</span>{' '}
                            {booking.pickup_location}
                            {' → '}
                            <span className="font-medium">{t('supplierBookings.toLabel')}</span>{' '}
                            {booking.dropoff_location}
                          </div>
                          {booking.flight_number && (
                            <div className="text-muted-foreground">
                              {t('supplierBookings.flightLabel', {
                                number: booking.flight_number,
                                time: booking.flight_time,
                              })}
                            </div>
                          )}
                          {booking.client_phone && (
                            <div className="text-muted-foreground">
                              {t('supplierBookings.clientPhoneLabel', { phone: booking.client_phone })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Hotel Details */}
                      {isHotelBooking && (
                        <div className="bg-green-50 dark:bg-green-950/40 rounded-lg p-3 text-sm space-y-1">
                          <div className="flex items-center gap-2 font-medium text-green-800 dark:text-green-300">
                            <Hotel className="w-4 h-4" />
                            {t('supplierBookings.hotelBooking')}
                          </div>
                          <div className="flex gap-4 text-muted-foreground">
                            {booking.room_category && (
                              <span>
                                {t('supplierBookings.roomLabel')} <strong>{booking.room_category}</strong>
                              </span>
                            )}
                            {booking.meal_basis && (
                              <span>
                                {t('supplierBookings.basisLabel')}{' '}
                                <strong>{MEAL_BASIS_LABELS[booking.meal_basis] || booking.meal_basis}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {booking.notes && <p className="text-sm text-muted-foreground italic">{booking.notes}</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 min-w-[140px]">
                      {booking.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white w-full"
                            onClick={() => updateMutation.mutate({ id: booking.id, status: 'confirmed' })}
                            disabled={updateMutation.isPending}
                          >
                            {updateMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            {t('supplierBookings.confirm')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 w-full"
                            onClick={() => updateMutation.mutate({ id: booking.id, status: 'cancelled' })}
                            disabled={updateMutation.isPending}
                          >
                            {updateMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            {t('common.cancel')}
                          </Button>
                        </>
                      )}
                      {booking.status === 'confirmed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 w-full"
                          onClick={() => updateMutation.mutate({ id: booking.id, status: 'cancelled' })}
                          disabled={updateMutation.isPending}
                        >
                          {updateMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          {t('common.cancel')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-600 dark:hover:text-red-300 w-full"
                        onClick={() => deleteMutation.mutate(booking.id)}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-1" />
                        )}
                        {deleteMutation.isPending ? t('supplierBookings.deleting') : t('common.delete')}
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
