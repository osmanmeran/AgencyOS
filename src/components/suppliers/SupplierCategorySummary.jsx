import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import {
  FolderTree, Users, ClipboardList, ChevronDown, ChevronRight,
  ArrowRight, Star, Tag
} from 'lucide-react';

export default function SupplierCategorySummary() {
  const [expandedCategories, setExpandedCategories] = useState(/** @type {any} */ ({}));

  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['supplierCategories'],
    queryFn: () => db.entities.SupplierCategory.list()
  }));

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['suppliers'],
    queryFn: () => db.entities.Supplier.list()
  }));

  const { data: pricingList = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['allPricing'],
    queryFn: () => db.entities.SupplierPricing.list()
  }));

  const { data: bookingRequests = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['allBookingRequests'],
    queryFn: () => db.entities.BookingRequest.list('-service_date')
  }));

  const toggleCategory = (id) => {
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getCategoryStats = (categoryId) => {
    const catSuppliers = suppliers.filter(s => s.category_id === categoryId);
    const supplierIds = new Set(catSuppliers.map(s => s.id));
    const catPricing = pricingList.filter(p => supplierIds.has(p.supplier_id));
    const catBookings = bookingRequests.filter(b => supplierIds.has(b.supplier_id));
    const pendingBookings = catBookings.filter(b => b.status === 'pending').length;
    const confirmedBookings = catBookings.filter(b => b.status === 'confirmed').length;
    const avgRating = catSuppliers.length > 0
      ? (catSuppliers.reduce((sum, s) => sum + (s.rating || 0), 0) / catSuppliers.filter(s => s.rating).length || 0).toFixed(1)
      : '—';
    const minPrice = catPricing.length > 0 ? Math.min(...catPricing.map(p => p.base_price)) : null;
    const maxPrice = catPricing.length > 0 ? Math.max(...catPricing.map(p => p.base_price)) : null;

    return { catSuppliers, catPricing, catBookings, pendingBookings, confirmedBookings, avgRating, minPrice, maxPrice };
  };

  if (categories.length === 0) {
    return (
      <Card className="p-12 text-center bg-white">
        <FolderTree className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">No categories yet. Create categories first.</p>
        <Link to={createPageUrl('Categories')}>
          <Button className="mt-4 bg-blue-600 hover:bg-blue-700">Go to Categories</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{categories.length} categories · {suppliers.length} suppliers · {bookingRequests.length} booking requests</p>
        <Link to={createPageUrl('Categories')}>
          <Button variant="outline" size="sm">Manage Categories <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
        </Link>
      </div>

      {categories.map(category => {
        const { catSuppliers, catPricing, catBookings, pendingBookings, confirmedBookings, avgRating, minPrice, maxPrice } = getCategoryStats(category.id);
        const isExpanded = expandedCategories[category.id];
        const color = category.color || '#3B82F6';

        return (
          <Card key={category.id} className="bg-white overflow-hidden">
            {/* Category Header Row */}
            <button
              className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors"
              onClick={() => toggleCategory(category.id)}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
                <FolderTree className="w-5 h-5" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 text-lg">{category.name}</span>
                  {pendingBookings > 0 && (
                    <Badge className="bg-amber-100 text-amber-800 text-xs">{pendingBookings} pending</Badge>
                  )}
                </div>
                {category.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{category.description}</p>}
              </div>

              {/* Quick stats */}
              <div className="hidden sm:flex items-center gap-6 text-sm flex-shrink-0">
                <div className="text-center">
                  <div className="font-bold text-slate-800">{catSuppliers.length}</div>
                  <div className="text-xs text-slate-500">Suppliers</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-slate-800">{catBookings.length}</div>
                  <div className="text-xs text-slate-500">Bookings</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-slate-800">{catPricing.length}</div>
                  <div className="text-xs text-slate-500">Price Tiers</div>
                </div>
                {minPrice !== null && (
                  <div className="text-center">
                    <div className="font-bold text-green-700">${minPrice}–${maxPrice}</div>
                    <div className="text-xs text-slate-500">Price Range</div>
                  </div>
                )}
              </div>

              <div className="ml-2 flex-shrink-0">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </div>
            </button>

            {/* Expanded Detail */}
            {isExpanded && (
              <div className="border-t border-slate-100 px-5 py-4 space-y-4 bg-slate-50/50">

                {/* Booking Status Row */}
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-sm">
                    <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-amber-800 font-medium">{pendingBookings} Pending</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-sm">
                    <ClipboardList className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-green-800 font-medium">{confirmedBookings} Confirmed</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-sm">
                    <Tag className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-blue-800 font-medium">{catPricing.length} Price Tiers</span>
                  </div>
                  {avgRating !== '—' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-50 border border-yellow-200 text-sm">
                      <Star className="w-3.5 h-3.5 text-yellow-500" />
                      <span className="text-yellow-800 font-medium">Avg {avgRating} stars</span>
                    </div>
                  )}
                </div>

                {/* Suppliers in this category */}
                {catSuppliers.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Suppliers</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {catSuppliers.slice(0, 6).map(supplier => {
                        const supplierPricing = pricingList.filter(p => p.supplier_id === supplier.id);
                        const supplierBookings = bookingRequests.filter(b => b.supplier_id === supplier.id);
                        const pending = supplierBookings.filter(b => b.status === 'pending').length;
                        return (
                          <Link key={supplier.id} to={createPageUrl(`SupplierDetails?id=${supplier.id}`)}>
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all group">
                              <div className="min-w-0">
                                <div className="font-medium text-slate-800 text-sm truncate group-hover:text-blue-600">{supplier.name}</div>
                                <div className="text-xs text-slate-500">{supplier.city || supplier.area || '—'} · {supplierPricing.length} prices</div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                {pending > 0 && (
                                  <Badge className="bg-amber-100 text-amber-700 text-xs px-1.5">{pending}</Badge>
                                )}
                                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500" />
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                      {catSuppliers.length > 6 && (
                        <div className="flex items-center justify-center p-3 bg-white rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">
                          +{catSuppliers.length - 6} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Recent Bookings */}
                {catBookings.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recent Booking Requests</p>
                    <div className="space-y-1.5">
                      {catBookings.slice(0, 4).map(booking => {
                        const supplier = suppliers.find(s => s.id === booking.supplier_id);
                        const statusColors = {
                          pending: 'bg-amber-100 text-amber-800',
                          confirmed: 'bg-green-100 text-green-800',
                          rejected: 'bg-red-100 text-red-800',
                          cancelled: 'bg-slate-100 text-slate-600',
                          completed: 'bg-blue-100 text-blue-800',
                        };
                        return (
                          <div key={booking.id} className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-slate-200 text-sm">
                            <Badge className={`text-xs flex-shrink-0 ${statusColors[booking.status] || 'bg-slate-100 text-slate-600'}`}>
                              {booking.status}
                            </Badge>
                            <span className="text-slate-600 truncate">{supplier?.name || '—'}</span>
                            <span className="text-slate-400 flex-shrink-0 ml-auto">{booking.service_date}</span>
                            {booking.total_cost > 0 && (
                              <span className="text-green-700 font-medium flex-shrink-0">${booking.total_cost}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Link to={createPageUrl(`Suppliers?category=${category.id}`)}>
                    <Button variant="outline" size="sm" className="text-xs">
                      <Users className="w-3.5 h-3.5 mr-1" /> All Suppliers
                    </Button>
                  </Link>
                  <Link to={createPageUrl('SupplierBookings')}>
                    <Button variant="outline" size="sm" className="text-xs">
                      <ClipboardList className="w-3.5 h-3.5 mr-1" /> All Bookings
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}