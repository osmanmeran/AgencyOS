import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Trash2, ShoppingCart, Send, ImageOff } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { createPageUrl } from '../../utils';
import { submitQuote } from '@/lib/b2bApi';
import { UNIT_LABELS, lineTotal, useCart } from '@/lib/b2bCart';

// The quote-request checkout panel. Reads the shared cart (which may hold
// items from several suppliers) and turns it into a QuoteRequest.
export default function QuoteCart() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { items: cart, removeItem, updateQuantity, clear } = useCart();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  const total = cart.reduce((sum, item) => sum + lineTotal(item), 0);

  const submitMutation = /** @type {any} */ (useMutation({
    mutationFn: () => submitQuote({
      title: title || 'Quote request',
      items: cart.map(i => ({ pricing_id: i.pricing_id, quantity: i.quantity })),
      notes,
    }),
    onSuccess: (quote) => {
      showSuccess('Quote request submitted');
      clear();
      queryClient.invalidateQueries({ queryKey: ['myQuotes'] });
      navigate(createPageUrl(`ClientQuoteDetails?id=${quote.id}`));
    },
    onError: (error) => showError('Failed to submit quote request', error.message),
  }));

  return (
    <Card className="p-5 bg-white shadow-sm sticky top-20">
      <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
        <ShoppingCart className="w-4 h-4 text-blue-600" />
        Your Quote Request
        {cart.length > 0 && (
          <span className="ml-auto text-xs font-semibold text-white bg-blue-600 rounded-full px-2 py-0.5">{cart.length}</span>
        )}
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
                  {item.supplier_name && <div className="text-[11px] text-slate-400 truncate">{item.supplier_name}</div>}
                  <div className="text-xs text-slate-500">{UNIT_LABELS[item.unit] || item.unit} · ${item.unit_price.toFixed(2)}</div>
                </div>
                <Button
                  variant="ghost" size="icon"
                  className="w-6 h-6 text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                  onClick={() => removeItem(item.pricing_id)}
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
  );
}
