import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { SkeletonTable } from '@/components/ui/skeletons';
import { Search, Plus, Trash2, ShoppingCart, Send, ImageOff } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../utils';
import { getCatalog, submitQuote } from '@/lib/b2bApi';

const UNIT_LABELS = {
  per_person: 'Per Person',
  per_group: 'Per Group',
  per_night: 'Per Night',
  per_trip: 'Per Trip',
  per_hour: 'Per Hour',
  per_day: 'Per Day',
  flat_rate: 'Flat Rate',
};

function lineTotal(item) {
  if (item.unit === 'per_group' || item.unit === 'flat_rate') return item.unit_price;
  return item.unit_price * item.quantity;
}

export default function ClientCatalog() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState(/** @type {any[]} */ ([]));

  const { data, isLoading } = /** @type {any} */ (useQuery({
    queryKey: ['b2bCatalog'],
    queryFn: getCatalog,
  }));

  const items = data?.items || [];

  const filteredItems = items.filter(i =>
    searchTerm === '' ||
    i.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedItems = filteredItems.reduce((acc, item) => {
    const key = item.supplier_name || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, /** @type {any} */ ({}));

  const addToCart = (item) => {
    setCart(prev => {
      if (prev.some(i => i.pricing_id === item.pricing_id)) return prev;
      return [...prev, { ...item, quantity: item.min_quantity || 1 }];
    });
  };

  const removeFromCart = (pricingId) => setCart(prev => prev.filter(i => i.pricing_id !== pricingId));

  const updateQuantity = (pricingId, quantity) => {
    setCart(prev => prev.map(i => i.pricing_id === pricingId ? { ...i, quantity } : i));
  };

  const total = cart.reduce((sum, item) => sum + lineTotal(item), 0);

  const submitMutation = /** @type {any} */ (useMutation({
    mutationFn: () => submitQuote({
      title: title || 'Quote request',
      items: cart.map(i => ({ pricing_id: i.pricing_id, quantity: i.quantity })),
      notes,
    }),
    onSuccess: (quote) => {
      showSuccess('Quote request submitted');
      queryClient.invalidateQueries({ queryKey: ['myQuotes'] });
      navigate(createPageUrl(`ClientQuoteDetails?id=${quote.id}`));
    },
    onError: (error) => showError('Failed to submit quote request', error.message),
  }));

  if (isLoading) {
    return <SkeletonTable />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Request a Quote</h1>
        <p className="text-slate-600">Browse available services and build a quote request</p>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* LEFT: Catalog */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search services or suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {Object.keys(groupedItems).length === 0 && (
            <Card className="p-12 text-center bg-white">
              <p className="text-slate-500">No services available right now. Check back soon.</p>
            </Card>
          )}

          {Object.entries(groupedItems).map(([supplierName, svcs]) => (
            <div key={supplierName}>
              <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">{supplierName}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-2">
                {/** @type {any[]} */ (svcs).map(item => {
                  const inCart = cart.some(i => i.pricing_id === item.pricing_id);
                  return (
                    <Card key={item.pricing_id} className="overflow-hidden bg-white shadow-sm hover:shadow-md transition-all p-0">
                      <div className="h-28 bg-slate-100">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageOff className="w-7 h-7 text-slate-300" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="text-sm font-medium text-slate-800 truncate" title={item.name}>{item.name}</div>
                        {item.description && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.description}</div>}
                        <div className="flex items-end justify-between mt-2 gap-2">
                          <div>
                            <div className="font-semibold text-green-700 text-sm">${item.unit_price.toFixed(2)}</div>
                            <div className="text-xs text-slate-500">{UNIT_LABELS[item.unit] || item.unit}</div>
                          </div>
                          <Button
                            size="sm"
                            variant={inCart ? 'outline' : 'default'}
                            disabled={inCart}
                            className={inCart ? 'flex-shrink-0' : 'bg-blue-600 hover:bg-blue-700 flex-shrink-0'}
                            onClick={() => addToCart(item)}
                          >
                            {inCart ? 'Added' : <Plus className="w-4 h-4" />}
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

        {/* RIGHT: Cart / Quote Request */}
        <div className="w-full lg:w-96 flex-shrink-0">
          <Card className="p-5 bg-white shadow-sm sticky top-20">
            <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              Your Quote Request
            </h2>

            <div className="space-y-2 mb-4">
              <Label htmlFor="quote-title">Title</Label>
              <Input
                id="quote-title"
                placeholder="e.g. Summer Package"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {cart.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400 mb-4">
                Add services from the catalog to build your quote.
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                {cart.map(item => (
                  <div key={item.pricing_id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                    <div className="flex justify-between items-start gap-2">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <ImageOff className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{item.name}</div>
                        <div className="text-xs text-slate-500">{UNIT_LABELS[item.unit] || item.unit} · ${item.unit_price.toFixed(2)}</div>
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        className="w-6 h-6 text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                        onClick={() => removeFromCart(item.pricing_id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      {item.unit === 'per_group' || item.unit === 'flat_rate' ? (
                        <span className="text-xs text-slate-400">Fixed price</span>
                      ) : (
                        <Input
                          type="number" min={item.min_quantity || 1}
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.pricing_id, Math.max(item.min_quantity || 1, parseFloat(e.target.value) || 1))}
                          className="h-7 w-20 text-xs text-center px-1"
                        />
                      )}
                      <span className="font-bold text-green-700 text-sm">${lineTotal(item).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 mb-4">
              <Label htmlFor="quote-notes">Notes (optional)</Label>
              <Textarea
                id="quote-notes"
                placeholder="Travel dates, special requests..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <Separator className="mb-4" />

            <div className="flex justify-between text-lg font-bold text-slate-900 mb-4">
              <span>Total</span>
              <span className="text-green-700">${total.toFixed(2)}</span>
            </div>

            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={cart.length === 0 || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              <Send className="w-4 h-4 mr-2" />
              {submitMutation.isPending ? 'Submitting...' : 'Submit Quote Request'}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
