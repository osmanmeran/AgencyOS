import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SkeletonTable } from '@/components/ui/skeletons';
import { ArrowLeft, MapPin, Star, Globe } from 'lucide-react';
import { createPageUrl } from '../utils';
import { getSupplierCatalog } from '@/lib/b2bApi';
import { useActAsClientId } from '@/lib/actAsClient';
import ServiceCard from '@/components/b2b/ServiceCard';
import QuoteCart from '@/components/b2b/QuoteCart';

export default function ClientSupplier() {
  const [searchParams] = useSearchParams();
  const supplierId = searchParams.get('id');
  const actAsClientId = useActAsClientId();

  const { data, isLoading, isError } = /** @type {any} */ (useQuery({
    queryKey: ['b2bSupplier', supplierId, actAsClientId],
    queryFn: () => getSupplierCatalog(supplierId),
    enabled: !!supplierId,
  }));

  if (isLoading) {
    return <SkeletonTable />;
  }

  if (isError || !data?.supplier) {
    return (
      <div className="space-y-6">
        <Link to={createPageUrl('ClientPortal')}>
          <Button variant="ghost" className="gap-2"><ArrowLeft className="w-4 h-4" /> Back to Home</Button>
        </Link>
        <Card className="p-12 text-center bg-white">
          <p className="text-slate-500">This supplier is not available right now.</p>
        </Card>
      </div>
    );
  }

  const { supplier, items = [] } = data;

  return (
    <div className="space-y-6">
      <Link to={createPageUrl('ClientPortal')}>
        <Button variant="ghost" className="gap-2"><ArrowLeft className="w-4 h-4" /> Back to Home</Button>
      </Link>

      <Card className="p-6 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{supplier.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {supplier.category_name && (
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: `${supplier.category_color || '#64748b'}20`,
                    color: supplier.category_color || '#475569',
                  }}
                >
                  {supplier.category_name}
                </span>
              )}
              {supplier.city && (
                <span className="flex items-center gap-1 text-sm text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {supplier.city}{supplier.area ? ` — ${supplier.area}` : ''}
                </span>
              )}
              {supplier.rating ? (
                <span className="flex items-center gap-1 text-sm text-slate-600">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  {supplier.rating}
                </span>
              ) : null}
              {supplier.website && (
                <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  <Globe className="w-4 h-4" /> Website
                </a>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* LEFT: this supplier's services */}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Services</h2>
          {items.length === 0 ? (
            <Card className="p-12 text-center bg-white">
              <p className="text-slate-500">No services available from this supplier right now.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {items.map(item => <ServiceCard key={item.pricing_id} item={item} />)}
            </div>
          )}
        </div>

        {/* RIGHT: shared quote cart */}
        <div className="w-full lg:w-96 flex-shrink-0">
          <QuoteCart />
        </div>
      </div>
    </div>
  );
}
