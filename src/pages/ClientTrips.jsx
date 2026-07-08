import { db } from '@/lib/DbContext';

import { useQuery } from '@tanstack/react-query';
import { useMyClient } from '@/hooks/useMyClient';

import { Card } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeletons';
import { Plane, Calendar, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format, differenceInDays } from 'date-fns';
import { useT } from '@/lib/i18n/I18nContext';

export default function ClientTrips() {
  const { t } = useT();
  const client = useMyClient();

  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['myTrips', client?.id],
      queryFn: () => db.entities.Trip.filter({ client_id: client.id }),
      enabled: !!client,
    })
  );

  if (!client) {
    return <SkeletonTable />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">{t('clientTrips.title')}</h1>
        <p className="text-muted-foreground">{t('clientTrips.subtitle')}</p>
      </div>

      {trips.length === 0 ? (
        <Card className="p-12 text-center bg-card">
          <div className="bg-blue-100 dark:bg-blue-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plane className="w-8 h-8 text-blue-600 dark:text-blue-300" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">{t('clientTrips.noTripsTitle')}</h3>
          <p className="text-muted-foreground">{t('clientTrips.noTripsBody')}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map((trip) => {
            const duration = differenceInDays(new Date(trip.end_date), new Date(trip.start_date)) + 1;
            const daysUntil = differenceInDays(new Date(trip.start_date), new Date());
            const isUpcoming = daysUntil >= 0;

            return (
              <Link key={trip.id} to={createPageUrl(`ClientTripDetails?id=${trip.id}`)}>
                <Card className="overflow-hidden hover:shadow-2xl transition-all cursor-pointer bg-card">
                  <div className="relative h-48">
                    <img
                      src={
                        trip.image_url ||
                        'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop'
                      }
                      alt={trip.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                    {isUpcoming && daysUntil <= 30 && (
                      <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                        {daysUntil === 0 ? t('clientTrips.today') : t('common.daysCount', { count: daysUntil })}
                      </div>
                    )}

                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-white text-xl font-bold mb-1">{trip.name}</h3>
                      <div className="flex items-center gap-2 text-white/90 text-sm">
                        <MapPin className="w-4 h-4" />
                        {trip.destination}
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d, yyyy')}
                    </div>
                    <div className="text-blue-600 dark:text-blue-300 font-semibold">
                      {t('common.daysCount', { count: duration })}
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
