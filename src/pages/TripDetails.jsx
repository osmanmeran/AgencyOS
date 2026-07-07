import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Sparkles, Calendar as CalendarIcon, DollarSign, Hash, Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { format } from 'date-fns';
import PackingList from '../components/trip-details/PackingList';
import Itinerary from '../components/trip-details/Itinerary';
import TripFinancialReport from '../components/trips/TripFinancialReport';
import AutoInvoiceGenerator from '../components/invoices/AutoInvoiceGenerator';
import SaveAsTemplateButton from '../components/trips/SaveAsTemplateButton';

export default function TripDetails() {
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get('id');
  const [generatingList, setGeneratingList] = useState(false);
  const queryClient = useQueryClient();

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
    })
  );

  const { data: itineraryEvents = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['itineraryEvents', tripId],
      queryFn: () => db.entities.ItineraryEvent.filter({ trip_id: tripId }, 'date'),
    })
  );

  const { data: invoices = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['tripInvoices'],
      queryFn: () => db.entities.Invoice.list(),
    })
  );

  const { data: tripClient } = /** @type {any} */ (
    useQuery({
      queryKey: ['tripClient', trip?.client_id],
      queryFn: () => db.entities.Client.get(trip.client_id),
      enabled: !!trip?.client_id,
    })
  );

  const { data: appSettings } = /** @type {any} */ (
    useQuery({
      queryKey: ['appSettings'],
      queryFn: async () => {
        const all = await db.entities.AppSettings.list();
        return all[0] || {};
      },
    })
  );

  const tripInvoices = invoices.filter((inv) => inv.trip_id === tripId);

  const totalCost = itineraryEvents.reduce((sum, event) => sum + (event.cost || 0), 0);

  const generatePackingList = async () => {
    setGeneratingList(true);
    try {
      const prompt = `Generate a comprehensive packing list for a trip to ${trip.destination} from ${format(new Date(trip.start_date), 'MMM d')} to ${format(new Date(trip.end_date), 'MMM d, yyyy')}. 
      Activities planned: ${trip.activities?.join(', ') || 'general tourism'}.
      
      Return a JSON array of items with this structure:
      [{"item_name": "...", "category": "Clothing|Toiletries|Electronics|Documents|Medication|Activities|Other", "quantity": 1}]
      
      Be specific and practical. Include essentials based on destination, duration, and activities.`;

      const response = await db.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  item_name: { type: 'string' },
                  category: { type: 'string' },
                  quantity: { type: 'number' },
                },
              },
            },
          },
        },
      });

      const itemsToCreate = response.items.map((item) => ({
        trip_id: tripId,
        ...item,
        packed: false,
      }));

      await db.entities.PackingItem.bulkCreate(itemsToCreate);
      queryClient.invalidateQueries({ queryKey: ['packingItems', tripId] });
    } finally {
      setGeneratingList(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading trip details...</p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Trip not found</p>
      </div>
    );
  }

  const isApprovedAndOngoing =
    (trip.status === 'confirmed' || trip.status === 'in_progress') && new Date(trip.end_date) >= new Date();

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <Link to={createPageUrl('Reservations')}>
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Reservations
          </Button>
        </Link>
        <div className="flex flex-wrap gap-2">
          <SaveAsTemplateButton trip={trip} />
          {isApprovedAndOngoing && (
            <>
              <AutoInvoiceGenerator
                trip={trip}
                client={tripClient}
                existingInvoices={tripInvoices}
                settings={appSettings}
              />
              <Link to={createPageUrl(`CreateInvoice?tripId=${tripId}`)}>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Invoice
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Trip Header */}
      <div className="relative h-64 rounded-2xl overflow-hidden shadow-xl">
        <img
          src={
            trip.image_url || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop'
          }
          alt={trip.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold text-white">{trip.name}</h1>
              {trip.reference_number && (
                <Badge className="bg-white/20 text-white border-white/30 font-mono">
                  <Hash className="w-3 h-3 mr-1" />
                  {trip.reference_number}
                </Badge>
              )}
            </div>
            <p className="text-white/90 text-lg">{trip.destination}</p>
            <div className="flex items-center gap-4 text-white/80 mt-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                <span>
                  {format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d, yyyy')}
                </span>
              </div>
              {trip.department && (
                <Badge variant="outline" className="border-white/30 text-white">
                  {trip.department}
                </Badge>
              )}
            </div>
          </div>
          {totalCost > 0 && (
            <div className="bg-white/20 backdrop-blur-md rounded-xl px-6 py-3 border border-white/30">
              <div className="text-white/80 text-sm mb-1">Total Trip Cost</div>
              <div className="text-white text-2xl font-bold flex items-center gap-2">
                <DollarSign className="w-6 h-6" />
                {totalCost.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="itinerary" className="space-y-6">
        <TabsList className="bg-card border border-border p-1">
          <TabsTrigger value="itinerary" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Itinerary
          </TabsTrigger>
          <TabsTrigger value="financial" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Financial Report
          </TabsTrigger>
          <TabsTrigger value="packing" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Packing List
          </TabsTrigger>
        </TabsList>

        <TabsContent value="packing" className="space-y-4">
          {packingItems.length === 0 && (
            <div className="bg-card rounded-xl p-8 text-center shadow-sm">
              <div className="bg-blue-100 dark:bg-blue-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-300" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Generate Smart Packing List</h3>
              <p className="text-muted-foreground mb-6">
                Let AI create a personalized packing list based on your destination and activities
              </p>
              <Button onClick={generatePackingList} disabled={generatingList} className="bg-blue-600 hover:bg-blue-700">
                {generatingList ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Packing List
                  </>
                )}
              </Button>
            </div>
          )}
          <PackingList tripId={tripId} items={packingItems} />
        </TabsContent>

        <TabsContent value="itinerary">
          <Itinerary tripId={tripId} trip={trip} events={itineraryEvents} />
        </TabsContent>

        <TabsContent value="financial">
          <TripFinancialReport trip={trip} events={itineraryEvents} invoices={invoices} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
