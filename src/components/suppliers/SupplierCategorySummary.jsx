import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import {
  FolderTree,
  Users,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Star,
  Tag,
  Plus,
  Edit,
  Trash2,
} from 'lucide-react';
import { categoryIdsBySupplier, getSupplierCategoryIds } from '@/lib/supplierCategories';
import { useT } from '@/lib/i18n/I18nContext';
import { getCurrencySymbol, mixedCurrencyLabel } from '@/lib/formatters';
import { usePermissions } from '@/components/permissions/PermissionContext';
import { showSuccess, showError } from '@/lib/toast';

export default function SupplierCategorySummary() {
  const { t } = useT();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [expandedCategories, setExpandedCategories] = useState(/** @type {any} */ ({}));

  // Category management (create/edit/delete) lives here now — this tab
  // replaced the old standalone Categories page.
  const canManage = hasPermission('manage_categories');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(/** @type {any} */ (null));
  const [formData, setFormData] = useState({ name: '', description: '', color: '#3B82F6' });

  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierCategories'],
      queryFn: () => db.entities.SupplierCategory.list(),
    })
  );

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['suppliers'],
      queryFn: () => db.entities.Supplier.list(),
    })
  );

  const { data: pricingList = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['allPricing'],
      queryFn: () => db.entities.SupplierPricing.list(),
    })
  );

  const { data: subcategories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['allSupplierSubcategories'],
      queryFn: () => db.entities.SupplierSubcategory.list(),
    })
  );

  const { data: bookingRequests = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['allBookingRequests'],
      queryFn: () => db.entities.BookingRequest.list('-service_date'),
    })
  );

  const supplierCategoryMap = categoryIdsBySupplier(subcategories);
  const categoryBySubcategoryId = new Map(subcategories.map((sc) => [sc.id, sc.category_id]));

  const toggleCategory = (id) => {
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Both query keys are in use: this tab caches under 'supplierCategories',
  // while ReservationDetails still reads the same list under 'categories'.
  const invalidateCategories = () => {
    queryClient.invalidateQueries({ queryKey: ['supplierCategories'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCategory(null);
  };

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.SupplierCategory.create(data),
      onSuccess: () => {
        showSuccess(t('categories.createSuccess'));
        invalidateCategories();
        closeModal();
      },
      onError: (error) => showError(t('categories.createError'), error.message),
    })
  );

  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) => db.entities.SupplierCategory.update(id, data),
      onSuccess: () => {
        showSuccess(t('categories.updateSuccess'));
        invalidateCategories();
        closeModal();
      },
      onError: (error) => showError(t('categories.updateError'), error.message),
    })
  );

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.SupplierCategory.delete(id),
      onSuccess: () => {
        showSuccess(t('categories.deleteSuccess'));
        invalidateCategories();
      },
      onError: (error) => showError(t('categories.deleteError'), error.message),
    })
  );

  const openModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name || '',
        description: category.description || '',
        color: category.color || '#3B82F6',
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', description: '', color: '#3B82F6' });
    }
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const categoryModal = (
    <Dialog open={modalOpen} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingCategory ? t('categories.editCategory') : t('categories.createCategory')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">{t('categories.categoryNameLabel')}</Label>
            <Input
              id="cat-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('categories.categoryNamePlaceholder')}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cat-description">{t('categories.descriptionLabel')}</Label>
            <Textarea
              id="cat-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('categories.descriptionPlaceholder')}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cat-color">{t('categories.colorLabel')}</Label>
            <div className="flex gap-3 items-center">
              <Input
                id="cat-color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-20 h-10"
              />
              <span className="text-sm text-muted-foreground">{formData.color}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">{editingCategory ? t('categories.update') : t('categories.create')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  const getCategoryStats = (categoryId) => {
    const catSuppliers = suppliers.filter((s) =>
      getSupplierCategoryIds(supplierCategoryMap, s.id).includes(categoryId),
    );
    const supplierIds = new Set(catSuppliers.map((s) => s.id));
    // Pricing tiers with a subcategory are matched to that subcategory's own
    // category (accurate for suppliers spanning several categories); tiers
    // without one fall back to "belongs to a supplier in this category".
    const catPricing = pricingList.filter((p) => {
      if (!supplierIds.has(p.supplier_id)) return false;
      if (p.subcategory_id) return categoryBySubcategoryId.get(p.subcategory_id) === categoryId;
      return true;
    });
    const catBookings = bookingRequests.filter((b) => supplierIds.has(b.supplier_id));
    const pendingBookings = catBookings.filter((b) => b.status === 'pending').length;
    const confirmedBookings = catBookings.filter((b) => b.status === 'confirmed').length;
    const avgRating =
      catSuppliers.length > 0
        ? (
            catSuppliers.reduce((sum, s) => sum + (s.rating || 0), 0) / catSuppliers.filter((s) => s.rating).length || 0
          ).toFixed(1)
        : '—';
    // Price tiers can each carry a different currency (SupplierPricing.currency)
    // — a raw min/max across all of them would mix magnitudes from different
    // currencies into one meaningless range. Range on the first currency
    // found (same rule mixedCurrencyLabel uses everywhere else), and flag
    // when other currencies exist too.
    const {
      symbol: priceSymbol,
      currencies: priceCurrencies,
      isMixed: hasMixedCurrencies,
    } = mixedCurrencyLabel(catPricing, 'currency');
    const primaryCurrency = priceCurrencies[0] || 'USD';
    const primaryPricing = catPricing.filter((p) => (p.currency || 'USD') === primaryCurrency);
    const minPrice = primaryPricing.length > 0 ? Math.min(...primaryPricing.map((p) => p.base_price)) : null;
    const maxPrice = primaryPricing.length > 0 ? Math.max(...primaryPricing.map((p) => p.base_price)) : null;

    return {
      catSuppliers,
      catPricing,
      catBookings,
      pendingBookings,
      confirmedBookings,
      avgRating,
      minPrice,
      maxPrice,
      priceSymbol,
      hasMixedCurrencies,
    };
  };

  if (categories.length === 0) {
    return (
      <Card className="p-12 text-center bg-card">
        <FolderTree className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">{t('supplierCategorySummary.noCategoriesTitle')}</p>
        {canManage && (
          <Button className="mt-4" onClick={() => openModal()}>
            <Plus className="w-4 h-4 mr-2" />
            {t('categories.createCategory')}
          </Button>
        )}
        {categoryModal}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('supplierCategorySummary.summaryLine', {
            categories: categories.length,
            suppliers: suppliers.length,
            bookings: bookingRequests.length,
          })}
        </p>
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => openModal()}>
            <Plus className="w-3.5 h-3.5 mr-1" /> {t('categories.newCategory')}
          </Button>
        )}
      </div>

      {categories.map((category) => {
        const {
          catSuppliers,
          catPricing,
          catBookings,
          pendingBookings,
          confirmedBookings,
          avgRating,
          minPrice,
          maxPrice,
          priceSymbol,
          hasMixedCurrencies,
        } = getCategoryStats(category.id);
        const isExpanded = expandedCategories[category.id];
        const color = category.color || '#3B82F6';

        return (
          <Card key={category.id} className="bg-card overflow-hidden">
            {/* Category Header Row */}
            <button
              className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-muted transition-colors"
              onClick={() => toggleCategory(category.id)}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${color}20` }}
              >
                <FolderTree className="w-5 h-5" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground text-lg">{category.name}</span>
                  {pendingBookings > 0 && (
                    <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs">
                      {t('supplierCategorySummary.pendingBadge', { count: pendingBookings })}
                    </Badge>
                  )}
                </div>
                {category.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{category.description}</p>
                )}
              </div>

              {/* Quick stats */}
              <div className="hidden sm:flex items-center gap-6 text-sm flex-shrink-0">
                <div className="text-center">
                  <div className="font-bold text-foreground">{catSuppliers.length}</div>
                  <div className="text-xs text-muted-foreground">{t('nav.suppliers')}</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-foreground">{catBookings.length}</div>
                  <div className="text-xs text-muted-foreground">{t('supplierCategorySummary.bookingsLabel')}</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-foreground">{catPricing.length}</div>
                  <div className="text-xs text-muted-foreground">{t('supplierCategorySummary.priceTiersLabel')}</div>
                </div>
                {minPrice !== null && (
                  <div className="text-center">
                    <div className="font-bold text-green-700 dark:text-green-300">
                      {priceSymbol}
                      {minPrice}–{priceSymbol}
                      {maxPrice}
                      {hasMixedCurrencies && '*'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('supplierCategorySummary.priceRangeLabel')}
                      {hasMixedCurrencies && ' *other currencies too'}
                    </div>
                  </div>
                )}
              </div>

              <div className="ml-2 flex-shrink-0">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Expanded Detail */}
            {isExpanded && (
              <div className="border-t border-border px-5 py-4 space-y-4 bg-muted/50">
                {/* Booking Status Row */}
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-sm">
                    <ClipboardList className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
                    <span className="text-amber-800 dark:text-amber-300 font-medium">
                      {t('supplierCategorySummary.pendingChip', { count: pendingBookings })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-sm">
                    <ClipboardList className="w-3.5 h-3.5 text-green-600 dark:text-green-300" />
                    <span className="text-green-800 dark:text-green-300 font-medium">
                      {t('supplierCategorySummary.confirmedChip', { count: confirmedBookings })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-sm">
                    <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-300" />
                    <span className="text-blue-800 dark:text-blue-300 font-medium">
                      {t('supplierCategorySummary.priceTiersChip', { count: catPricing.length })}
                    </span>
                  </div>
                  {avgRating !== '—' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 text-sm">
                      <Star className="w-3.5 h-3.5 text-yellow-500 dark:text-yellow-300" />
                      <span className="text-yellow-800 dark:text-yellow-300 font-medium">
                        {t('supplierCategorySummary.avgStarsChip', { rating: avgRating })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Suppliers in this category */}
                {catSuppliers.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {t('nav.suppliers')}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {catSuppliers.slice(0, 6).map((supplier) => {
                        const supplierPricing = pricingList.filter((p) => p.supplier_id === supplier.id);
                        const supplierBookings = bookingRequests.filter((b) => b.supplier_id === supplier.id);
                        const pending = supplierBookings.filter((b) => b.status === 'pending').length;
                        return (
                          <Link key={supplier.id} to={createPageUrl(`SupplierDetails?id=${supplier.id}`)}>
                            <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-sm transition-all group">
                              <div className="min-w-0">
                                <div className="font-medium text-foreground text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-300">
                                  {supplier.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {supplier.city || supplier.area || '—'} ·{' '}
                                  {t('supplierCategorySummary.pricesCount', { count: supplierPricing.length })}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                {pending > 0 && (
                                  <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs px-1.5">
                                    {pending}
                                  </Badge>
                                )}
                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-blue-500 dark:group-hover:text-blue-300" />
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                      {catSuppliers.length > 6 && (
                        <div className="flex items-center justify-center p-3 bg-card rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                          {t('dashboard.moreCount', { count: catSuppliers.length - 6 })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Recent Bookings */}
                {catBookings.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {t('supplierCategorySummary.recentBookingsTitle')}
                    </p>
                    <div className="space-y-1.5">
                      {catBookings.slice(0, 4).map((booking) => {
                        const supplier = suppliers.find((s) => s.id === booking.supplier_id);
                        const statusColors = {
                          pending: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',
                          confirmed: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
                          rejected: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
                          cancelled: 'bg-muted text-muted-foreground',
                          completed: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
                        };
                        const statusLabelKeys = {
                          pending: 'common.pending',
                          confirmed: 'common.confirmed',
                          rejected: 'common.rejected',
                          cancelled: 'common.cancelled',
                          completed: 'tripStatus.completed',
                        };
                        return (
                          <div
                            key={booking.id}
                            className="flex items-center gap-3 px-3 py-2 bg-card rounded-lg border border-border text-sm"
                          >
                            <Badge
                              className={`text-xs flex-shrink-0 ${statusColors[booking.status] || 'bg-muted text-muted-foreground'}`}
                            >
                              {statusLabelKeys[booking.status] ? t(statusLabelKeys[booking.status]) : booking.status}
                            </Badge>
                            <span className="text-muted-foreground truncate">{supplier?.name || '—'}</span>
                            <span className="text-muted-foreground flex-shrink-0 ml-auto">{booking.service_date}</span>
                            {booking.total_cost > 0 && (
                              <span className="text-green-700 dark:text-green-300 font-medium flex-shrink-0">
                                {getCurrencySymbol(booking.currency || 'USD')}
                                {booking.total_cost}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1 flex-wrap">
                  <Link to={createPageUrl(`Suppliers?category=${category.id}`)}>
                    <Button variant="outline" size="sm" className="text-xs">
                      <Users className="w-3.5 h-3.5 mr-1" /> {t('supplierCategorySummary.allSuppliers')}
                    </Button>
                  </Link>
                  <Link to={createPageUrl('SupplierBookings')}>
                    <Button variant="outline" size="sm" className="text-xs">
                      <ClipboardList className="w-3.5 h-3.5 mr-1" /> {t('supplierCategorySummary.allBookings')}
                    </Button>
                  </Link>
                  {canManage && (
                    <>
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => openModal(category)}>
                        <Edit className="w-3.5 h-3.5 mr-1" /> {t('categories.editCategory')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
                        onClick={() => deleteMutation.mutate(category.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> {t('common.delete')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </Card>
        );
      })}
      {categoryModal}
    </div>
  );
}
