import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMyClient } from '@/hooks/useMyClient';

import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  MapPin,
  Map,
  MessageSquare,
  List,
  Share2,
  Check,
  Ban,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format } from 'date-fns';
import MessageThread from '../components/messaging/MessageThread';
import ItineraryTimeline from '../components/client-trip/ItineraryTimeline';
import { DaySection, ServiceCard } from '../components/client-trip/ServiceItineraryCards';
import TripMap from '../components/client-trip/TripMap';
import TripApprovalBar from '../components/client-trip/TripApprovalBar';
import { groupServicesByDay } from '../lib/serviceItinerary';
import { useT } from '@/lib/i18n/I18nContext';
import { showSuccess, showError } from '@/lib/toast';

export default function ClientTripDetails() {
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get('id');
  const client = useMyClient();
  const queryClient = useQueryClient();
  const [shareCopied, setShareCopied] = useState(false);

  const { data: trip, isLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['trip', tripId],
      queryFn: () => db.entities.Trip.get(tripId),
      enabled: !!tripId,
    })
  );

  const { data: packingItems = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['packingItems', tripId],
      queryFn: () => db.entities.PackingItem.filter({ trip_id: tripId }),
      enabled: !!tripId,
    })
  );

  const { data: itineraryEvents = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['itineraryEvents', tripId],
      queryFn: () => db.entities.ItineraryEvent.filter({ trip_id: tripId }, 'date'),
      enabled: !!tripId,
    })
  );

  const shareMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () => db.trips.share(tripId, {}),
      onSuccess: (/** @type {any} */ result) => {
        queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
        navigator.clipboard.writeText(result.share_url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      },
      onError: (error) => showError('Failed to create share link', error.message),
    })
  );

  const revokeShareMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () => db.trips.revokeShare(tripId),
      onSuccess: () => {
        showSuccess('Public link disabled');
        queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      },
      onError: (error) => showError('Failed to disable the public link', error.message),
    })
  );

  if (isLoading || !client) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!trip || trip.client_id !== client.id) {
    return <div className="text-center py-20 text-muted-foreground">{t('clientTripDetails.notFoundOrDenied')}</div>;
  }

  const groupedItems = packingItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  // Staff-built ItineraryEvent records (from Itinerary Builder) take priority when
  // present; otherwise derive a day-by-day itinerary straight from the trip's
  // services, same as the public itinerary share page, so confirmed reservations
  // show an itinerary without requiring separate manual entry.
  const hasManualEvents = itineraryEvents.length > 0;
  const services = (trip.services || []).filter((s) => s.show_in_itinerary !== false);
  const { sortedDays, dayServices, unscheduled } = groupServicesByDay(services);
  const mapEvents = hasManualEvents
    ? itineraryEvents
    : services
        .filter((s) => s.location)
        .map((s) => ({ id: s._key, title: s.name, location: s.location, date: s.start_date, time: s.pickup_time }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to={createPageUrl('ClientTrips')}>
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('clientTripDetails.backToTrips')}
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => shareMutation.mutate()}>
            {shareCopied ? (
              <Check className="w-4 h-4 text-green-600 dark:text-green-300" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            {shareCopied ? t('clientItinerary.copied') : t('clientTripDetails.shareItinerary')}
          </Button>
          {trip.share_enabled && (
            <Button variant="outline" className="gap-2" onClick={() => revokeShareMutation.mutate()}>
              <Ban className="w-4 h-4" />
              {t('clientTripDetails.stopSharing')}
            </Button>
          )}
        </div>
      </div>

      {/* Trip Header */}
      <div className="relative h-72 rounded-2xl overflow-hidden shadow-xl">
        <img
          src={
            trip.image_url || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop'
          }
          alt={trip.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
        <div className="absolute bottom-8 left-8 right-8">
          <h1 className="text-4xl font-bold text-white mb-2">{trip.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-white/90">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>{trip.destination}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              <span>
                {format(new Date(trip.start_date), 'MMM d')} – {format(new Date(trip.end_date), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Approval Bar */}
      <TripApprovalBar trip={trip} clientId={client.id} />

      {/* Tabs */}
      <Tabs defaultValue="itinerary" className="space-y-6">
        <TabsList className="bg-card border border-border p-1">
          <TabsTrigger value="itinerary" className="gap-2">
            <List className="w-4 h-4" />
            {t('clientTripDetails.itinerary')}
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-2">
            <Map className="w-4 h-4" />
            {t('clientTripDetails.map')}
          </TabsTrigger>
          <TabsTrigger value="packing" className="gap-2">
            {t('clientTripDetails.packingList')}
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            {t('clientTripDetails.messages')}
          </TabsTrigger>
        </TabsList>

        {/* Itinerary Tab */}
        <TabsContent value="itinerary">
          <Card className="p-6 bg-card shadow-md">
            <h2 className="text-2xl font-bold text-foreground mb-6">{t('clientTripDetails.yourItinerary')}</h2>
            {hasManualEvents ? (
              <ItineraryTimeline events={itineraryEvents} />
            ) : sortedDays.length > 0 || unscheduled.length > 0 ? (
              <div className="space-y-2">
                {sortedDays.map((date, idx) => (
                  <DaySection key={date} date={date} services={dayServices[date]} dayIndex={idx} />
                ))}
                {unscheduled.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold text-foreground mb-3">{t('clientTripDetails.otherServices')}</h3>
                    <div className="space-y-3">
                      {unscheduled.map((svc, idx) => (
                        <ServiceCard key={idx} service={svc} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <List className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p>{t('clientTripDetails.noItinerary')}</p>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Map Tab */}
        <TabsContent value="map">
          <Card className="p-6 bg-card shadow-md">
            <h2 className="text-2xl font-bold text-foreground mb-6">{t('clientTripDetails.tripMap')}</h2>
            <TripMap events={mapEvents} />
          </Card>
        </TabsContent>

        {/* Packing Tab */}
        <TabsContent value="packing">
          <Card className="p-6 bg-card shadow-md">
            <h2 className="text-2xl font-bold text-foreground mb-6">{t('clientTripDetails.packingList')}</h2>
            {packingItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">{t('clientTripDetails.noPackingList')}</p>
            ) : (
              <div className="space-y-6">
                {Object.keys(groupedItems).map((category) => (
                  <div key={category}>
                    <h3 className="font-semibold text-lg text-foreground mb-3">{category}</h3>
                    <div className="space-y-2">
                      {groupedItems[category].map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              item.packed ? 'bg-green-500 border-green-500' : 'border-border'
                            }`}
                          >
                            {item.packed && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span
                            className={`flex-1 ${item.packed ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                          >
                            {item.item_name}
                          </span>
                          {item.quantity > 1 && <span className="text-sm text-muted-foreground">x{item.quantity}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages">
          <MessageThread clientId={client.id} referenceType="trip" referenceId={tripId} isAgent={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
