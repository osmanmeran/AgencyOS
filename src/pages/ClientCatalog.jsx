import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SkeletonTable } from '@/components/ui/skeletons';
import { Search } from 'lucide-react';
import { getCatalog } from '@/lib/b2bApi';
import ServiceCard from '@/components/b2b/ServiceCard';
import QuoteCart from '@/components/b2b/QuoteCart';

export default function ClientCatalog() {
  const [searchTerm, setSearchTerm] = useState('');

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

  if (isLoading) {
    return <SkeletonTable />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Request a Quote</h1>
        <p className="text-slate-600">Browse every available service and build a quote request</p>
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
                {/** @type {any[]} */ (svcs).map(item => (
                  <ServiceCard key={item.pricing_id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT: shared quote cart */}
        <div className="w-full lg:w-96 flex-shrink-0">
          <QuoteCart />
        </div>
      </div>
    </div>
  );
}
