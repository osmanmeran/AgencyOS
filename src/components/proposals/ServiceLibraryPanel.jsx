import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { categoryIdsBySupplier, getSupplierCategoryIds } from '@/lib/supplierCategories';
import { useT } from '@/lib/i18n/I18nContext';

export default function ServiceLibraryPanel({ numTravelers, acquiringCurrency, _sellingCurrency, onAddService }) {
  const { t } = useT();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expanded, setExpanded] = useState(/** @type {any} */ ({}));

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({ queryKey: ['suppliers'], queryFn: () => db.entities.Supplier.list() })
  );
  const { data: allPricings = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({ queryKey: ['supplierPricings'], queryFn: () => db.entities.SupplierPricing.list() })
  );
  const { data: subcategories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({ queryKey: ['supplierSubcategories'], queryFn: () => db.entities.SupplierSubcategory.list() })
  );
  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({ queryKey: ['supplierCategories'], queryFn: () => db.entities.SupplierCategory.list() })
  );

  // Find the best price tier for current pax count
  const getBestPricing = (supplierId) => {
    const pricings = allPricings.filter((p) => p.supplier_id === supplierId && p.is_active !== false);
    if (!pricings.length) return null;
    // Find tier where pax fits within min/max range, prefer closest min_quantity
    const matching = pricings.filter((p) => {
      const min = p.min_quantity || 1;
      const max = p.max_quantity || 99999;
      return numTravelers >= min && numTravelers <= max;
    });
    return matching.length ? matching[0] : pricings[0];
  };

  const supplierCategoryMap = categoryIdsBySupplier(subcategories);

  const filteredSuppliers = suppliers.filter((s) => {
    const matchSearch = !searchTerm || s.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat =
      categoryFilter === 'all' || getSupplierCategoryIds(supplierCategoryMap, s.id).includes(categoryFilter);
    const hasPricing = allPricings.some((p) => p.supplier_id === s.id && p.is_active !== false);
    return matchSearch && matchCat && hasPricing;
  });

  // Suppliers offering services in several categories appear under each of them.
  const groupedByCategory = filteredSuppliers.reduce((acc, s) => {
    const catIds = getSupplierCategoryIds(supplierCategoryMap, s.id);
    const keys = catIds.length ? catIds : ['other'];
    for (const catId of keys) {
      if (!acc[catId]) acc[catId] = [];
      acc[catId].push(s);
    }
    return acc;
  }, {});

  const toggleCat = (catId) => setExpanded((prev) => ({ ...prev, [catId]: !prev[catId] }));

  return (
    <Card className="p-4 bg-card shadow-sm sticky top-20 max-h-[85vh] flex flex-col">
      <h2 className="font-bold text-foreground mb-3 flex items-center gap-2 flex-shrink-0">
        <Plus className="w-4 h-4 text-blue-600 dark:text-blue-300" />
        {t('serviceLibraryPanel.title')}
      </h2>

      <div className="space-y-2 mb-3 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={t('serviceLibraryPanel.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-sm h-8"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="text-sm h-8">
            <SelectValue placeholder={t('serviceLibraryPanel.allCategoriesPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('serviceLibraryPanel.allCategories')}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded">
          <Users className="w-3 h-3" />
          <span>{t('serviceLibraryPanel.showingPricesFor', { n: numTravelers })}</span>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 space-y-2 pr-1">
        {Object.keys(groupedByCategory).length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">{t('serviceLibraryPanel.noServicesFound')}</p>
        )}
        {Object.entries(groupedByCategory).map(([catId, suppliersInCat]) => {
          const catName = categories.find((c) => c.id === catId)?.name || t('serviceLibraryPanel.otherCategory');
          const isOpen = expanded[catId] !== false;
          return (
            <div key={catId}>
              <button
                onClick={() => toggleCat(catId)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted"
              >
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{catName}</span>
                {isOpen ? (
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                )}
              </button>
              {isOpen && (
                <div className="space-y-1 ml-1">
                  {suppliersInCat.map((supplier) => {
                    const bestPricing = getBestPricing(supplier.id);
                    const supplierPricings = allPricings.filter(
                      (p) => p.supplier_id === supplier.id && p.is_active !== false,
                    );
                    if (!bestPricing) return null;
                    const subcat = subcategories.find((s) => s.id === bestPricing.subcategory_id);
                    return (
                      <div
                        key={supplier.id}
                        className="p-2.5 rounded-lg border border-border hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">{supplier.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {bestPricing.name}
                              {subcat ? ` · ${subcat.name}` : ''}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-xs font-bold text-red-600 dark:text-red-300">
                                {acquiringCurrency} {(bestPricing.base_price || 0).toFixed(2)}
                              </span>
                              <span className="text-xs text-muted-foreground">/</span>
                              <span className="text-xs text-muted-foreground">
                                {t('serviceLibraryPanel.paxUnitLabel', { unit: bestPricing.unit || 'per_person' })}
                              </span>
                            </div>
                            {supplierPricings.length > 1 && (
                              <div className="mt-1">
                                <Badge variant="outline" className="text-xs px-1 py-0">
                                  {t('serviceLibraryPanel.priceTiersCount', { count: supplierPricings.length })}
                                </Badge>
                              </div>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7 flex-shrink-0 opacity-0 group-hover:opacity-100 text-blue-600 dark:text-blue-300"
                            onClick={() =>
                              onAddService({
                                supplier_id: supplier.id,
                                supplier_name: supplier.name,
                                name: bestPricing.name,
                                description: bestPricing.description || '',
                                acquiring_price: bestPricing.base_price || 0,
                                acquiring_currency: acquiringCurrency,
                                selling_price:
                                  bestPricing.client_price ||
                                  bestPricing.base_price * (1 + (bestPricing.markup_percentage || 0) / 100),
                                quantity: numTravelers,
                                pricing_id: bestPricing.id,
                                pax_tiers: supplierPricings.map((p) => ({
                                  id: p.id,
                                  name: p.name,
                                  min: p.min_quantity || 1,
                                  max: p.max_quantity,
                                  base_price: p.base_price,
                                })),
                              })
                            }
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
