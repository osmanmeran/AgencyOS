import { db } from '@/lib/DbContext';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeletons';
import {
  ArrowLeft,
  CalendarDays,
  Users,
  Plane,
  Hotel,
  DollarSign,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';
import { useT } from '@/lib/i18n/I18nContext';

const STATUS_STYLES = {
  pending: { color: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300', icon: Clock },
  confirmed: { color: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300', icon: CheckCircle },
  cancelled: { color: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300', icon: XCircle },
};

export default function SupplierBookingDetails() {
  const { t } = useT();
  const MEAL_BASIS_LABELS = {
    RO: t('supplierBookings.mealRO'),
    BB: t('supplierBookings.mealBB'),
    HB: t('supplierBookings.mealHB'),
    FB: t('supplierBookings.mealFB'),
    AI: t('supplierBookings.mealAI'),
    UAI: t('supplierBookings.mealUAI'),
  };
  const [params] = useSearchParams();
  const bookingId = params.get('id');

  const queryClient = useQueryClient();

  const { data: booking, isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierBooking', bookingId],
      queryFn: () => db.entities.SupplierBooking.get(bookingId),
      enabled: !!bookingId,
    })
  );

  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { status }) => db.entities.SupplierBooking.update(bookingId, { status }),
      onSuccess: () => {
        showSuccess(t('supplierBookingDetails.updateSuccess'));
        queryClient.invalidateQueries({ queryKey: ['supplierBooking', bookingId] });
        queryClient.invalidateQueries({ queryKey: ['supplierBookings'] });
      },
      onError: (error) => showError(t('supplierBookingDetails.updateError'), error.message),
    })
  );

  if (isLoading) return <SkeletonCard />;
  if (!booking)
    return <div className="text-center py-20 text-muted-foreground">{t('supplierBookingDetails.notFound')}</div>;

  const { color, icon: StatusIcon } = STATUS_STYLES[booking.status] || STATUS_STYLES.pending;
  const isHotel = booking.category_name?.toLowerCase().includes('hotel');
  const isTransfer = booking.category_name?.toLowerCase().includes('transfer');

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('SupplierBookings')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{booking.supplier_name}</h1>
            <p className="text-sm text-muted-foreground">{t('supplierBookingDetails.bookingDetails')}</p>
          </div>
        </div>
        <Badge className={`${color} text-sm px-3 py-1.5`}>
          <StatusIcon className="w-4 h-4 mr-1 inline" />
          {t(`common.${booking.status}`)}
        </Badge>
      </div>

      <Card className="p-6 bg-card space-y-6">
        {/* Service Info */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            {t('supplierBookingDetails.serviceInformation')}
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t('supplierBookingDetails.serviceType')}</span>
              <p className="font-medium text-foreground">{booking.service_type}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('supplierBookingDetails.category')}</span>
              <p className="font-medium text-foreground">{booking.category_name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('supplierBookingDetails.numberOfPeople')}</span>
              <p className="font-medium text-foreground flex items-center gap-1">
                <Users className="w-4 h-4 text-muted-foreground" /> {booking.num_people}
              </p>
            </div>
            {booking.pricing_name && (
              <div>
                <span className="text-muted-foreground">{t('supplierBookingDetails.rateApplied')}</span>
                <p className="font-medium text-foreground">{booking.pricing_name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Date Info */}
        <div className="border-t pt-4">
          <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-300" />
            {t('supplierBookingDetails.dateAndSchedule')}
          </h3>
          {isHotel && booking.check_in_date ? (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t('supplierBookingDetails.checkIn')}</span>
                <p className="font-medium">{booking.check_in_date}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('supplierBookingDetails.checkOut')}</span>
                <p className="font-medium">{booking.check_out_date}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('supplierBookingDetails.nights')}</span>
                <p className="font-medium">{booking.num_nights}</p>
              </div>
            </div>
          ) : (
            <div className="text-sm">
              <span className="text-muted-foreground">{t('supplierBookingDetails.serviceDate')}</span>
              <p className="font-medium">{booking.service_date}</p>
            </div>
          )}
        </div>

        {/* Transfer Details */}
        {isTransfer && (
          <div className="border-t pt-4">
            <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
              <Plane className="w-4 h-4 text-blue-600 dark:text-blue-300" />
              {t('supplierBookingDetails.transferDetails')}
            </h3>
            <div className="bg-blue-50 dark:bg-blue-950/40 rounded-lg p-4 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-muted-foreground">{t('supplierBookingDetails.type')}</span>
                  <p className="font-medium capitalize">{booking.transfer_type?.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('supplierBookingDetails.from')}</span>
                <p className="font-medium">{booking.pickup_location}</p>
                {booking.origin_supplier_name && (
                  <p className="text-xs text-muted-foreground">
                    {t('supplierBookingDetails.supplierLabel', { name: booking.origin_supplier_name })}
                  </p>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">{t('supplierBookingDetails.to')}</span>
                <p className="font-medium">{booking.dropoff_location}</p>
                {booking.destination_supplier_name && (
                  <p className="text-xs text-muted-foreground">
                    {t('supplierBookingDetails.supplierLabel', { name: booking.destination_supplier_name })}
                  </p>
                )}
              </div>
              {booking.flight_number && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground">{t('supplierBookingDetails.flight')}</span>
                    <p className="font-medium">{booking.flight_number}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('supplierBookingDetails.time')}</span>
                    <p className="font-medium">{booking.flight_time}</p>
                  </div>
                </div>
              )}
              {booking.client_phone && (
                <div>
                  <span className="text-muted-foreground">{t('supplierBookingDetails.clientPhone')}</span>
                  <p className="font-medium">{booking.client_phone}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hotel Details */}
        {isHotel && (
          <div className="border-t pt-4">
            <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
              <Hotel className="w-4 h-4 text-green-600 dark:text-green-300" />
              {t('supplierBookingDetails.roomDetails')}
            </h3>
            <div className="bg-green-50 dark:bg-green-950/40 rounded-lg p-4 text-sm space-y-2">
              <div className="grid grid-cols-2 gap-4">
                {booking.room_category && (
                  <div>
                    <span className="text-muted-foreground">{t('supplierBookingDetails.roomCategory')}</span>
                    <p className="font-medium">{booking.room_category}</p>
                  </div>
                )}
                {booking.meal_basis && (
                  <div>
                    <span className="text-muted-foreground">{t('supplierBookingDetails.mealBasis')}</span>
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
            <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600 dark:text-green-300" />
              {t('supplierBookingDetails.cost')}
            </h3>
            <div className="text-lg font-bold text-green-700 dark:text-green-300">
              {booking.currency} {Number(booking.total_cost).toFixed(2)}
            </div>
          </div>
        )}

        {/* Notes */}
        {booking.notes && (
          <div className="border-t pt-4">
            <h3 className="font-semibold text-foreground mb-2">{t('common.notes')}</h3>
            <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">{booking.notes}</p>
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {booking.status === 'pending' && (
          <>
            <Button
              onClick={() => updateMutation.mutate({ status: 'confirmed' })}
              className="bg-green-600 hover:bg-green-700"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              {updateMutation.isPending ? 'Saving...' : 'Confirm Booking'}
            </Button>
            <Button
              onClick={() => updateMutation.mutate({ status: 'cancelled' })}
              variant="outline"
              className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-300"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              {updateMutation.isPending ? 'Saving...' : 'Cancel Booking'}
            </Button>
          </>
        )}
        {booking.status === 'confirmed' && (
          <Button
            onClick={() => updateMutation.mutate({ status: 'cancelled' })}
            variant="outline"
            className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-300"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4 mr-2" />
            )}
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
