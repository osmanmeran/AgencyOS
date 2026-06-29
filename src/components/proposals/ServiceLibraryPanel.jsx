const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, ChevronDown, ChevronRight, Users } from 'lucide-react';

export default function ServiceLibraryPanel({ numTravelers, acquiringCurrency, sellingCurrency, onAddService }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expanded, setExpanded] = useState({});

  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => db.entities.Supplier.list() });
  const { data: allPricings = [] } = useQuery({ queryKey: ['supplierPricings'], queryFn: () => db.entities.SupplierPricing.list() });
  const { data: subcategories = [] } = useQuery({ queryKey: ['supplierSubcategories'], queryFn: () => db.entities.SupplierSubcategory.list() });
  const { data: categories = [] } = useQuery({ queryKey: ['supplierCategories'], queryFn: () => db.entities.SupplierCategory.list() });

  // Find the best price tier for current pax count
  const getBestPricing = (supplierId) => {
    const pricings = allPricings.filter(p => p.supplier_id === supplierId && p.is_active !== false);
    if (!pricings.length) return null;
    // Find tier where pax fits within min/max range, prefer closest min_quantity
    const matching = pricings.filter(p => {
      const min = p.min_quantity || 1;
      const max = p.max_quantity || 99999;
      return numTravelers >= min && numTravelers <= max;
    });
    return matching.length ? matching[0] : pricings[0];
  };

  const filteredSuppliers = suppliers.filter(s => {
    const matchSearch = !searchTerm ||
      s.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = categoryFilter === 'all' || s.category_id === categoryFilter;
    const hasPricing = allPricings.some(p => p.supplier_id === s.id && p.is_active !== false);
    return matchSearch && matchCat && hasPricing;
  });

  const groupedByCategory = filteredSuppliers.reduce((acc, s) => {
    const catId = s.category_id || 'other';
    if (!acc[catId]) acc[catId] = [];
    acc[catId].push(s);
    return acc;
  }, {});

  const toggleCat = (catId) => setExpanded(prev => ({ ...prev, [catId]: !prev[catId] }));

  return (
    <Card className="p-4 bg-white shadow-sm sticky top-20 max-h-[85vh] flex flex-col">
      <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2 flex-shrink-0">
        <Plus className="w-4 h-4 text-blue-600" />
        Service Library
      </h2>

      <div className="space-y-2 mb-3 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search providers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-sm h-8"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="text-sm h-8">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
          <Users className="w-3 h-3" />
          <span>Showing prices for <strong>{numTravelers}</strong> pax</span>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 space-y-2 pr-1">
        {Object.keys(groupedByCategory).length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6">No services with pricing found</p>
        )}
        {Object.entries(groupedByCategory).map(([catId, suppliersInCat]) => {
          const catName = categories.find(c => c.id === catId)?.name || 'Other';
          const isOpen = expanded[catId] !== false;
          return (
            <div key={catId}>
              <button
                onClick={() => toggleCat(catId)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-50"
              >
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{catName}</span>
                {isOpen ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
              </button>
              {isOpen && (
                <div className="space-y-1 ml-1">
                  {suppliersInCat.map(supplier => {
                    const bestPricing = getBestPricing(supplier.id);
                    const supplierPricings = allPricings.filter(p => p.supplier_id === supplier.id && p.is_active !== false);
                    if (!bestPricing) return null;
                    const subcat = subcategories.find(s => s.id === bestPricing.subcategory_id);
                    return (
                      <div
                        key={supplier.id}
                        className="p-2.5 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-800 truncate">{supplier.name}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {bestPricing.name}{subcat ? ` · ${subcat.name}` : ''}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-xs font-bold text-red-600">
                                {acquiringCurrency} {(bestPricing.base_price || 0).toFixed(2)}
                              </span>
                              <span className="text-xs text-slate-300">/</span>
                              <span className="text-xs text-slate-500">pax · {bestPricing.unit || 'per_person'}</span>
                            </div>
                            {supplierPricings.length > 1 && (
                              <div className="mt-1">
                                <Badge variant="outline" className="text-xs px-1 py-0">
                                  {supplierPricings.length} price tiers
                                </Badge>
                              </div>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7 flex-shrink-0 opacity-0 group-hover:opacity-100 text-blue-600"
                            onClick={() => onAddService({
                              supplier_id: supplier.id,
                              supplier_name: supplier.name,
                              name: bestPricing.name,
                              description: bestPricing.description || '',
                              acquiring_price: bestPricing.base_price || 0,
                              acquiring_currency: acquiringCurrency,
                              selling_price: bestPricing.client_price || (bestPricing.base_price * (1 + (bestPricing.markup_percentage || 0) / 100)),
                              quantity: numTravelers,
                              pricing_id: bestPricing.id,
                              pax_tiers: supplierPricings.map(p => ({
                                id: p.id,
                                name: p.name,
                                min: p.min_quantity || 1,
                                max: p.max_quantity,
                                base_price: p.base_price,
                              })),
                            })}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}