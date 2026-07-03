import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, ImageOff } from 'lucide-react';
import { UNIT_LABELS, useCart } from '@/lib/b2bCart';

// A single purchasable service tile, shared by the supplier storefront page
// and the flat "Request a Quote" catalog. Adds itself to the shared cart.
export default function ServiceCard({ item }) {
  const { items, addItem } = useCart();
  const inCart = items.some(i => i.pricing_id === item.pricing_id);

  return (
    <Card className="overflow-hidden bg-white shadow-sm hover:shadow-md transition-all p-0">
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
            onClick={() => addItem(item)}
          >
            {inCart ? 'Added' : <Plus className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}
