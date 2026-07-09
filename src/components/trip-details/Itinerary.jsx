import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, MapPin, Clock, DollarSign, Trash2, Edit } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useT } from '@/lib/i18n/I18nContext';

export default function Itinerary({ tripId, trip, events }) {
  const { t } = useT();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    description: '',
    supplier_id: '',
    service_id: '',
    pricing_id: '',
    subcategory_id: '',
    quantity: 1,
    cost: '',
    supplier_cost: '',
  });
  const queryClient = useQueryClient();

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['suppliers'],
      queryFn: () => db.entities.Supplier.list(),
    })
  );

  const { data: allServices = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierServices'],
      queryFn: () => db.entities.SupplierService.list(),
    })
  );

  const { data: allPricings = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierPricings'],
      queryFn: () => db.entities.SupplierPricing.list(),
    })
  );

  const { data: subcategories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierSubcategories'],
      queryFn: () => db.entities.SupplierSubcategory.list(),
    })
  );

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.ItineraryEvent.create({ ...data, trip_id: tripId }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['itineraryEvents', tripId] });
        closeModal();
      },
    })
  );

  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) => db.entities.ItineraryEvent.update(id, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['itineraryEvents', tripId] });
        closeModal();
      },
    })
  );

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.ItineraryEvent.delete(id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['itineraryEvents', tripId] }),
    })
  );

  const openModal = (event = null) => {
    if (event) {
      setEditingEvent(event);
      setFormData({
        title: event.title || '',
        date: event.date || '',
        time: event.time || '',
        location: event.location || '',
        description: event.description || '',
        supplier_id: event.supplier_id || '',
        service_id: event.service_id || '',
        pricing_id: event.pricing_id || '',
        subcategory_id: event.subcategory_id || '',
        quantity: event.quantity || 1,
        cost: event.cost || '',
        supplier_cost: event.supplier_cost || '',
      });
    } else {
      setEditingEvent(null);
      setFormData({
        title: '',
        date: trip.start_date,
        time: '',
        location: '',
        description: '',
        supplier_id: '',
        service_id: '',
        pricing_id: '',
        subcategory_id: '',
        quantity: 1,
        cost: '',
        supplier_cost: '',
      });
    }
    setModalOpen(true);
  };

  const getClientPrice = (pricing) => {
    if (pricing.client_price != null && pricing.client_price > 0) return pricing.client_price;
    return pricing.base_price * (1 + (pricing.markup_percentage || 0) / 100);
  };

  const handlePricingChange = (pricingId) => {
    const pricing = allPricings.find((p) => p.id === pricingId);
    if (pricing) {
      const cp = getClientPrice(pricing);
      setFormData({
        ...formData,
        pricing_id: pricingId,
        supplier_id: pricing.supplier_id,
        subcategory_id: pricing.subcategory_id || '',
        supplier_cost: String(pricing.base_price * (formData.quantity || 1)),
        cost: String(cp * (formData.quantity || 1)),
      });
    } else {
      setFormData({ ...formData, pricing_id: '', supplier_cost: '' });
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingEvent(null);
  };

  const handleQuantityChange = (qty) => {
    const pricing = allPricings.find((p) => p.id === formData.pricing_id);
    if (pricing) {
      const cp = getClientPrice(pricing);
      setFormData({
        ...formData,
        quantity: qty,
        supplier_cost: String(pricing.base_price * qty),
        cost: String(cp * qty),
      });
    } else {
      setFormData({ ...formData, quantity: qty });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      cost: formData.cost ? parseFloat(formData.cost) : undefined,
      supplier_cost: formData.supplier_cost ? parseFloat(formData.supplier_cost) : undefined,
    };
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const dateKey = event.date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedEvents).sort();

  return (
    <div className="space-y-6">
      {/* Add Event Button */}
      <div className="flex justify-end">
        <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          {t('tripItinerary.addEvent')}
        </Button>
      </div>

      {/* Timeline */}
      {sortedDates.length === 0 ? (
        <Card className="p-12 text-center bg-card shadow-md">
          <div className="bg-blue-100 dark:bg-blue-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-blue-600 dark:text-blue-300" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">{t('tripItinerary.noEventsTitle')}</h3>
          <p className="text-muted-foreground mb-6">{t('tripItinerary.noEventsBody')}</p>
          <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            {t('tripItinerary.addFirstEvent')}
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {sortedDates.map((date) => (
            <div key={date} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md">
                  {format(parseISO(date), 'EEE, MMM d')}
                </div>
                <div className="flex-1 h-px bg-muted" />
              </div>

              <div className="space-y-3 ml-4 border-l-2 border-blue-200 dark:border-blue-800 pl-6">
                {groupedEvents[date].map((event) => {
                  const supplier = suppliers.find((s) => s.id === event.supplier_id);
                  const service = allServices.find((s) => s.id === event.service_id);
                  return (
                    <Card key={event.id} className="p-5 bg-card shadow-md hover:shadow-lg transition-shadow group">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {event.time && (
                              <span className="text-sm font-medium text-blue-600 dark:text-blue-300 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {event.time}
                              </span>
                            )}
                            <h4 className="font-semibold text-foreground text-lg">{event.title}</h4>
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-1 text-muted-foreground text-sm mb-2">
                              <MapPin className="w-4 h-4" />
                              {event.location}
                            </div>
                          )}
                          {event.description && <p className="text-muted-foreground text-sm">{event.description}</p>}
                          {supplier && (
                            <p className="text-sm text-blue-600 dark:text-blue-300 mt-2">
                              {t('tripItinerary.supplierLabel', { name: supplier.name })}
                              {service && ` - ${service.service_name}`}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {(event.cost || event.supplier_cost) && (
                            <div className="text-right">
                              {event.supplier_cost && (
                                <div className="text-xs text-muted-foreground">
                                  {t('tripItinerary.costLabel', {
                                    amount: parseFloat(event.supplier_cost).toFixed(2),
                                  })}
                                </div>
                              )}
                              {event.cost && (
                                <span className="text-green-600 dark:text-green-300 font-semibold flex items-center gap-1">
                                  <DollarSign className="w-4 h-4" />
                                  {parseFloat(event.cost).toFixed(2)}
                                </span>
                              )}
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openModal(event)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(event.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4 text-red-500 dark:text-red-300" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Event Modal */}
      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEvent ? t('tripItinerary.editEventTitle') : t('tripItinerary.addEvent')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t('tripItinerary.eventTitleLabel')}</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">{t('tripItinerary.dateLabel')}</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">{t('tripItinerary.timeLabel')}</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">{t('tripItinerary.locationLabel')}</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder={t('tripItinerary.locationPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('common.description')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier">{t('tripItinerary.supplierOptionalLabel')}</Label>
                <Select
                  value={formData.supplier_id}
                  onValueChange={(v) => setFormData({ ...formData, supplier_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('tripItinerary.selectSupplierPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>{t('common.none')}</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('tripItinerary.priceTierOptionalLabel')}</Label>
                <Select value={formData.pricing_id} onValueChange={handlePricingChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('tripItinerary.selectPricingPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>{t('common.none')}</SelectItem>
                    {allPricings
                      .filter(
                        (p) =>
                          p.is_active !== false && (!formData.supplier_id || p.supplier_id === formData.supplier_id),
                      )
                      .map((p) => {
                        const supplier = suppliers.find((s) => s.id === p.supplier_id);
                        const subcat = subcategories.find((s) => s.id === p.subcategory_id);
                        const clientPrice = p.base_price * (1 + (p.markup_percentage || 0) / 100);
                        return (
                          <SelectItem key={p.id} value={p.id}>
                            {supplier?.name} - {p.name} {subcat ? `(${subcat.name})` : ''} ${clientPrice.toFixed(2)}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg border border-border">
              <div className="space-y-2">
                <Label htmlFor="quantity">{t('tripItinerary.quantityPaxLabel')}</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier_cost" className="text-foreground font-semibold">
                  {t('tripItinerary.supplierCostLabel')}
                </Label>
                <Input
                  id="supplier_cost"
                  type="number"
                  step="0.01"
                  value={formData.supplier_cost}
                  onChange={(e) => setFormData({ ...formData, supplier_cost: e.target.value })}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">{t('tripItinerary.whatYouPay')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost" className="text-blue-700 dark:text-blue-300 font-semibold">
                  {t('tripItinerary.clientPriceLabel')}
                </Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  placeholder="0.00"
                  className="border-blue-300 dark:border-blue-800"
                />
                <p className="text-xs text-muted-foreground">{t('tripItinerary.whatYouCharge')}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeModal}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingEvent ? t('tripItinerary.updateEventButton') : t('tripItinerary.addEvent')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
