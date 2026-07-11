import { db } from '@/lib/DbContext';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { SkeletonCard } from '@/components/ui/skeletons';
import { Card } from '@/components/ui/card';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';
import { getCatalog, submitQuote } from '@/lib/b2bApi';
import { getActAsClientId, useActAsClientId } from '@/lib/actAsClient';
import { useMyClient } from '@/hooks/useMyClient';
import { useT } from '@/lib/i18n/I18nContext';
import { OCCUPANCY_LABELS, MEAL_TREATMENT_I18N_KEYS } from '@/lib/hotelPricing';
import HotelSearchWizard from '@/components/hotelSearch/HotelSearchWizard';
import HotelCart from '@/components/hotelSearch/HotelCart';

const rid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function ClientHotelSearch() {
  const { t } = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const client = useMyClient();
  const actAsClientId = useActAsClientId();
  const [isStaffPreview, setIsStaffPreview] = useState(false);
  const [cart, setCart] = useState(/** @type {any[]} */ ([]));
  const [trip, setTrip] = useState({ title: '', notes: '' });

  useEffect(() => {
    db.auth.me().then((me) => {
      setIsStaffPreview(!!getActAsClientId() && me.user_tier !== 'client');
    });
  }, [actAsClientId]);

  const { data: catalog, isLoading: catLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['b2bCatalog'],
      queryFn: getCatalog,
      enabled: !!client,
    })
  );

  const catalogItems = catalog?.items || [];
  const stopSales = catalog?.stop_sales || [];

  const addToCart = (item, unitPrice, nights, startDate, endDate) => {
    setCart((prev) => [
      ...prev,
      {
        _key: rid('room'),
        pricing_id: item.pricing_id,
        supplier_id: item.supplier_id,
        name: item.name,
        location: item.city || item.area || 'Other',
        occupancy: item.occupancy,
        meal_treatment: item.meal_treatment,
        unit_price: unitPrice,
        currency: item.currency,
        nights,
        start_date: startDate,
        end_date: endDate,
        quantity: 1,
        min_quantity: item.min_quantity || 1,
        max_quantity: item.max_quantity || 99,
        room_type: OCCUPANCY_LABELS[item.occupancy] || item.occupancy,
      },
    ]);
    showSuccess(t('hotelSearch.addToCart'));
  };

  const updateQuantity = (key, quantity) =>
    setCart((prev) => prev.map((l) => (l._key === key ? { ...l, quantity } : l)));

  const removeFromCart = (key) => setCart((prev) => prev.filter((l) => l._key !== key));

  const submitMutation = /** @type {any} */ (
    useMutation({
      mutationFn: () => {
        const locations = [...new Set(cart.map((l) => l.location))];
        const starts = cart.map((l) => l.start_date).sort();
        const ends = cart.map((l) => l.end_date).sort();
        return submitQuote({
          title: trip.title || 'Hotel booking request',
          destination: locations.join(' & '),
          destinations: locations.map((label) => ({ label })),
          start_date: starts[0],
          end_date: ends[ends.length - 1],
          notes: trip.notes,
          items: cart.map((l) => ({
            pricing_id: l.pricing_id,
            quantity: l.quantity,
            start_date: l.start_date,
            end_date: l.end_date,
            room_type: l.room_type,
            details: l.meal_treatment ? t(MEAL_TREATMENT_I18N_KEYS[l.meal_treatment] || '') || undefined : undefined,
          })),
        });
      },
      onSuccess: (quote) => {
        showSuccess(t('hotelSearch.submitRequest'));
        queryClient.invalidateQueries({ queryKey: ['myQuotes'] });
        navigate(createPageUrl(`ClientQuoteDetails?id=${quote.id}`));
      },
      onError: (error) => showError('Failed to submit quote request', error.message),
    })
  );

  if (!client || catLoading) return <SkeletonCard />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-1">{t('hotelSearch.title')}</h1>
        <p className="text-muted-foreground">{t('hotelSearch.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <HotelSearchWizard catalogItems={catalogItems} stopSales={stopSales} onAddToCart={addToCart} />
        </div>
        <div>
          {isStaffPreview && (
            <Card className="p-3 mb-3 text-sm text-muted-foreground bg-muted/40">
              Staff preview — submitting is disabled.
            </Card>
          )}
          <HotelCart
            cart={cart}
            onUpdateQuantity={updateQuantity}
            onRemove={removeFromCart}
            trip={trip}
            onTripChange={setTrip}
            onSubmit={() => submitMutation.mutate()}
            submitting={submitMutation.isPending}
            disabled={isStaffPreview}
          />
        </div>
      </div>
    </div>
  );
}
