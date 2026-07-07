import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Calendar, MapPin, ArrowRight, MoreVertical, Copy, Edit, Trash2, XCircle } from 'lucide-react';
import { usePermissions } from '../permissions/PermissionContext';
import { format, differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import TripEditModal from './TripEditModal';

export default function TripCard({ trip }) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const duration = differenceInDays(new Date(trip.end_date), new Date(trip.start_date)) + 1;
  const daysUntil = differenceInDays(new Date(trip.start_date), new Date());
  const isUpcoming = daysUntil >= 0;

  const canModify = hasPermission('modify_trips');
  //   const canCancel = hasPermission('cancel_trips');
  //   const canDelete = hasPermission('delete_trips');

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () => db.entities.Trip.delete(trip.id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips'] }),
    })
  );

  const duplicateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: async () => {
        const { ...tripData } = trip;
        return db.entities.Trip.create({
          ...tripData,
          name: `${trip.name} (Copy)`,
          reference_number: null,
        });
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips'] }),
    })
  );

  const cancelMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () => db.entities.Trip.update(trip.id, { ...trip, status: 'cancelled' }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips'] }),
    })
  );

  const handleAction = (e, action) => {
    e.preventDefault();
    e.stopPropagation();
    if (action === 'delete' && confirm('Delete this trip?')) deleteMutation.mutate();
    if (action === 'duplicate') duplicateMutation.mutate();
    if (action === 'cancel' && confirm('Cancel this trip?')) cancelMutation.mutate();
    if (action === 'edit') setEditModalOpen(true);
  };

  return (
    <>
      <Card className="group overflow-hidden hover:shadow-2xl transition-all duration-500 cursor-pointer bg-card border-0 relative">
        <div className="absolute top-3 right-3 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
              <Button variant="secondary" size="icon" className="h-8 w-8 bg-card/90 hover:bg-card shadow">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canModify && (
                <DropdownMenuItem onClick={(e) => handleAction(e, 'edit')}>
                  <Edit className="w-4 h-4 mr-2" /> Edit Reservation
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => handleAction(e, 'duplicate')}>
                <Copy className="w-4 h-4 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {trip.status !== 'cancelled' && (
                <DropdownMenuItem
                  onClick={(e) => handleAction(e, 'cancel')}
                  className="text-orange-600 dark:text-orange-300"
                >
                  <XCircle className="w-4 h-4 mr-2" /> Cancel Reservation
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => handleAction(e, 'delete')} className="text-red-600 dark:text-red-300">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Link to={createPageUrl(`ReservationDetails?id=${trip.id}`)}>
          <div className="relative h-48 overflow-hidden">
            <img
              src={
                trip.image_url ||
                `https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop`
              }
              alt={trip.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

            {trip.status === 'cancelled' && (
              <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                Cancelled
              </div>
            )}

            {isUpcoming && daysUntil <= 30 && trip.status !== 'cancelled' && (
              <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                {daysUntil === 0 ? 'Today!' : `${daysUntil} days`}
              </div>
            )}

            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white text-xl font-bold">{trip.name}</h3>
                {trip.reference_number && (
                  <Badge variant="secondary" className="bg-white/20 text-white text-xs font-mono">
                    {trip.reference_number}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-white/90 text-sm">
                <MapPin className="w-4 h-4" />
                <span>{trip.destination}</span>
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>
                  {format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d, yyyy')}
                </span>
              </div>
              <span className="text-blue-600 dark:text-blue-300 font-semibold">{duration} days</span>
            </div>

            {trip.department && (
              <Badge variant="outline" className="mt-2">
                {trip.department}
              </Badge>
            )}

            {trip.activities?.length > 0 && (
              <div className="flex gap-2 mt-4 flex-wrap">
                {trip.activities.slice(0, 3).map((activity, idx) => (
                  <span key={idx} className="px-3 py-1 bg-muted text-foreground text-xs rounded-full">
                    {activity}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end text-blue-600 dark:text-blue-300 font-medium text-sm group-hover:gap-2 gap-1 transition-all">
              View Details
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>
      </Card>

      <TripEditModal open={editModalOpen} onClose={() => setEditModalOpen(false)} trip={trip} />
    </>
  );
}
