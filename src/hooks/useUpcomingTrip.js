import { db } from '@/lib/DbContext';
import { useQuery } from '@tanstack/react-query';
import { differenceInDays, parseISO } from 'date-fns';

// Soonest upcoming (today or later) trip for a client — same logic and query
// key as ClientPortal.jsx's "Continue planning" card, so react-query shares
// the cached result rather than re-fetching. Used wherever a client can
// attach a new request (hotel/transfer/car rental) to an existing itinerary
// instead of submitting it standalone.
export function useUpcomingTrip(clientId) {
  const { data: trips = /** @type {any[]} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['myTrips', clientId],
      queryFn: () => db.entities.Trip.filter({ client_id: clientId }),
      enabled: !!clientId,
    })
  );

  const candidates = trips
    .filter((trip) => trip.status !== 'cancelled' && trip.start_date)
    .filter((trip) => differenceInDays(parseISO(trip.start_date), new Date()) >= 0)
    .sort((a, b) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime());

  return candidates[0] || null;
}
