import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useExport } from '@/hooks/useExport';
import { usePaginatedEntities } from '@/hooks/usePaginatedEntities';
import { useSelection } from '@/hooks/useSelection';
import { HOTEL_TYPE_OPTIONS, formatHotelType } from '@/lib/hotelTypes';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Edit,
  Trash2,
  Star,
  Search,
  Settings,
  X,
  ArrowUpDown,
  Upload,
  Filter,
  FilterX,
  Download,
  XCircle,
  Loader2,
} from 'lucide-react';
import LocationSearch from '@/components/services/LocationSearch';
import SupplierCsvImporter from '../components/suppliers/SupplierCsvImporter';
import SupplierCategorySummary from '../components/suppliers/SupplierCategorySummary';
import {
  SupplierTextFilter,
  SupplierCategoryFilter,
  SupplierRatingFilter,
  SupplierFilterButton,
} from '../components/suppliers/SupplierFilters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkeletonTable } from '@/components/ui/skeletons';
import BulkActionsBar from '@/components/shared/BulkActionsBar';
import PaginationControls from '@/components/shared/PaginationControls';
import { createPageUrl } from '../utils';
import { usePermissions } from '../components/permissions/PermissionContext';
import { showSuccess, showError } from '@/lib/toast';
import { categoryIdsBySupplier, getSupplierCategoryIds } from '@/lib/supplierCategories';

const SortHeader = ({ field, label, filter, filterActive, sortField, handleSort }) => (
  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
    <div className="flex items-center gap-1">
      <span className="cursor-pointer hover:text-foreground" onClick={() => handleSort(field)}>
        {label}
      </span>
      <ArrowUpDown
        className={`w-3 h-3 cursor-pointer ${sortField === field ? 'text-blue-600 dark:text-blue-300' : 'text-muted-foreground'}`}
        onClick={() => handleSort(field)}
      />
      {filter && <SupplierFilterButton active={filterActive}>{filter}</SupplierFilterButton>}
    </div>
  </th>
);

export default function Suppliers() {
  const [activeTab, setActiveTab] = useState('list');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [csvImporterOpen, setCsvImporterOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [extraColumns, setExtraColumns] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('supplier_extra_columns') || '[]');
    } catch {
      return [];
    }
  });
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [filters, setFilters] = useState({ name: '', category: [], city: '', area: '', rating: null });
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(/** @type {string[]} */ ([]));

  const activeFilterCount = [
    filters.name,
    filters.city,
    filters.area,
    filters.rating !== null,
    filters.category.length > 0,
  ].filter(Boolean).length;

  const clearFilters = () => setFilters({ name: '', category: [], city: '', area: '', rating: null });

  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    area: '',
    pricing_info: '',
    notes: '',
    // Star count (3–5) or a named hotel type ('boutique'/'cave') — see HOTEL_TYPE_OPTIONS
    rating: /** @type {number|string} */ (5),
    custom_fields: {},
  });
  const queryClient = useQueryClient();
  const { exportCSV } = useExport();
  const { hasPermission } = usePermissions();
  const isAdmin = hasPermission('manage_users');

  // Page size is generous because the existing rich per-column sort/filter
  // below (including deriving sort by category name) runs client-side over
  // whatever's fetched — with a small supplier count today, one page covers
  // everything, same as before. As supplier counts grow past the page size,
  // the search box (server-side) becomes the way to narrow the working set.
  const {
    items: suppliers,
    total,
    page,
    pageCount,
    pageSize,
    setPage,
    search: searchTerm,
    setSearch: setSearchTerm,
    isLoading,
    isFetching,
  } = usePaginatedEntities('Supplier', { pageSize: 100, sort: 'name' });

  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierCategories'],
      queryFn: () => db.entities.SupplierCategory.list(),
    })
  );

  const { data: subcategories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['allSupplierSubcategories'],
      queryFn: () => db.entities.SupplierSubcategory.list(),
    })
  );
  const supplierCategoryMap = categoryIdsBySupplier(subcategories);

  const { selectedIds, toggle, toggleAll, clear, allSelected, count: selectedCount } = useSelection(suppliers);

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.Supplier.create(data),
      onSuccess: () => {
        showSuccess('Supplier created');
        queryClient.invalidateQueries({ queryKey: ['Supplier'] });
        closeModal();
      },
      onError: (error) => showError('Failed to create supplier', error.message),
    })
  );

  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) => db.entities.Supplier.update(id, data),
      onSuccess: () => {
        showSuccess('Supplier updated');
        queryClient.invalidateQueries({ queryKey: ['Supplier'] });
        closeModal();
      },
      onError: (error) => showError('Failed to update supplier', error.message),
    })
  );

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.Supplier.delete(id),
      onSuccess: () => {
        showSuccess('Supplier deleted');
        queryClient.invalidateQueries({ queryKey: ['Supplier'] });
      },
      onError: (error) => showError('Failed to delete supplier', error.message),
    })
  );

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const result = await db.entities.Supplier.bulkDelete([...selectedIds]);
      if (result.skipped.length > 0) {
        showError(
          `${result.skipped.length} supplier(s) could not be deleted`,
          'You may not have permission for some of the selected suppliers.',
        );
      } else {
        showSuccess('Suppliers deleted');
      }
      clear();
      setBulkDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ['Supplier'] });
    } catch (error) {
      showError('Failed to delete suppliers', error.message);
    }
    setIsBulkDeleting(false);
  };

  const handleExportSelected = () => {
    const selected = suppliers.filter((s) => selectedIds.has(s.id));
    exportCSV(selected, 'suppliers-selected', [
      { label: 'Name', accessor: (s) => s.name },
      { label: 'Category', accessor: (s) => getCategoryNames(getSupplierCategoryIds(supplierCategoryMap, s.id)) },
      { label: 'Contact Person', accessor: (s) => s.contact_person },
      { label: 'Email', accessor: (s) => s.email },
      { label: 'Phone', accessor: (s) => s.phone },
      { label: 'City', accessor: (s) => s.city },
      { label: 'Area', accessor: (s) => s.area },
      { label: 'Rating', accessor: (s) => s.rating },
    ]);
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const all = searchTerm
        ? (await db.entities.Supplier.page({ search: searchTerm, limit: 500 })).data
        : await db.entities.Supplier.list();
      exportCSV(all, 'suppliers', [
        { label: 'Name', accessor: (s) => s.name },
        { label: 'Category', accessor: (s) => getCategoryNames(getSupplierCategoryIds(supplierCategoryMap, s.id)) },
        { label: 'Contact Person', accessor: (s) => s.contact_person },
        { label: 'Email', accessor: (s) => s.email },
        { label: 'Phone', accessor: (s) => s.phone },
        { label: 'City', accessor: (s) => s.city },
        { label: 'Area', accessor: (s) => s.area },
        { label: 'Rating', accessor: (s) => s.rating },
      ]);
    } catch (error) {
      showError('Failed to export suppliers', error.message);
    }
    setIsExporting(false);
  };

  const openModal = (supplier = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name || '',
        contact_person: supplier.contact_person || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        website: supplier.website || '',
        address: supplier.address || '',
        city: supplier.city || '',
        area: supplier.area || '',
        pricing_info: supplier.pricing_info || '',
        notes: supplier.notes || '',
        rating: supplier.rating || 5,
        custom_fields: supplier.custom_fields || {},
      });
      setSelectedCategoryIds(getSupplierCategoryIds(supplierCategoryMap, supplier.id));
    } else {
      setEditingSupplier(null);
      setFormData({
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        website: '',
        address: '',
        city: '',
        area: '',
        pricing_info: '',
        notes: '',
        rating: 5,
        custom_fields: {},
      });
      setSelectedCategoryIds([]);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSupplier(null);
  };

  // Syncs the supplier's SupplierSubcategory join rows to `selectedCategoryIds`:
  // creates a default subcategory for each newly-selected category and removes
  // the ones for categories that were deselected.
  const syncSupplierCategories = async (/** @type {any} */ supplierId) => {
    const existing = (subcategories || []).filter((s) => s.supplier_id === supplierId);
    const existingCatIds = existing.map((s) => s.category_id);
    const toAdd = selectedCategoryIds.filter((id) => !existingCatIds.includes(id));
    const toRemove = existing.filter((s) => !selectedCategoryIds.includes(s.category_id));

    for (const catId of toAdd) {
      const cat = categories.find((c) => c.id === catId);
      await db.entities.SupplierSubcategory.create({
        supplier_id: supplierId,
        category_id: catId,
        name: cat?.name || 'General',
      });
    }
    for (const sc of toRemove) {
      // Don't orphan prices/services still filed under this category.
      const [linkedPricings, linkedServices] = await Promise.all([
        db.entities.SupplierPricing.filter({ subcategory_id: sc.id }),
        db.entities.SupplierService.filter({ subcategory_id: sc.id }),
      ]);
      if (linkedPricings.length || linkedServices.length) {
        const cat = categories.find((c) => c.id === sc.category_id);
        showError(
          `${cat?.name || sc.name} still has prices or services linked to it — move or delete them first. The category was kept.`,
        );
        continue;
      }
      await db.entities.SupplierSubcategory.delete(sc.id);
    }
    queryClient.invalidateQueries({ queryKey: ['allSupplierSubcategories'] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingSupplier) {
      await updateMutation.mutateAsync({ id: editingSupplier.id, data: formData });
      await syncSupplierCategories(editingSupplier.id);
      closeModal();
    } else {
      const created = await createMutation.mutateAsync(formData);
      if (created?.id && selectedCategoryIds.length) {
        for (const catId of selectedCategoryIds) {
          const cat = categories.find((c) => c.id === catId);
          await db.entities.SupplierSubcategory.create({
            supplier_id: created.id,
            category_id: catId,
            name: cat?.name || 'General',
          });
        }
        queryClient.invalidateQueries({ queryKey: ['allSupplierSubcategories'] });
      }
      closeModal();
    }
  };

  const addExtraColumn = () => {
    if (!newColumnName.trim()) return;
    const key = newColumnName.trim().toLowerCase().replace(/\s+/g, '_');
    const updated = [...extraColumns, { key, label: newColumnName.trim() }];
    setExtraColumns(updated);
    localStorage.setItem('supplier_extra_columns', JSON.stringify(updated));
    setNewColumnName('');
  };

  const removeExtraColumn = (key) => {
    const updated = extraColumns.filter((c) => c.key !== key);
    setExtraColumns(updated);
    localStorage.setItem('supplier_extra_columns', JSON.stringify(updated));
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const getCategoryName = (id) => categories.find((c) => c.id === id)?.name || '—';
  const getCategoryColor = (id) => categories.find((c) => c.id === id)?.color || '#94a3b8';
  const getCategoryNames = (ids) =>
    (ids || []).length ? (ids || []).map((id) => getCategoryName(id)).join(', ') : '—';

  const filtered = suppliers
    .filter((s) => {
      // Free-text search already happened server-side (usePaginatedEntities);
      // these are the per-column refinement filters on top of that page.
      const nameMatch = !filters.name || s.name?.toLowerCase().includes(filters.name.toLowerCase());
      const categoryMatch =
        !filters.category?.length ||
        getSupplierCategoryIds(supplierCategoryMap, s.id).some((id) => filters.category.includes(id));
      const cityMatch = !filters.city || s.city?.toLowerCase().includes(filters.city.toLowerCase());
      const areaMatch = !filters.area || s.area?.toLowerCase().includes(filters.area.toLowerCase());
      const ratingMatch = !filters.rating?.length || filters.rating.includes(s.rating);

      return nameMatch && categoryMatch && cityMatch && areaMatch && ratingMatch;
    })
    .sort((a, b) => {
      let av = '',
        bv = '';
      if (sortField === 'category') {
        av = getCategoryNames(getSupplierCategoryIds(supplierCategoryMap, a.id));
        bv = getCategoryNames(getSupplierCategoryIds(supplierCategoryMap, b.id));
      } else if (sortField === 'rating') {
        av = a.rating || 0;
        bv = b.rating || 0;
      } else {
        av = a[sortField] || '';
        bv = b[sortField] || '';
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  if (isLoading) return <SkeletonTable />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Suppliers</h1>
          <p className="text-muted-foreground">Manage your travel supplier database</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportAll} disabled={isExporting}>
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Export CSV
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => setColumnManagerOpen(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Columns
            </Button>
          )}
          <Button variant="outline" onClick={() => setCsvImporterOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 shadow-lg">
            <Plus className="w-5 h-5 mr-2" />
            New Supplier
          </Button>
        </div>
      </div>

      {categories.length === 0 && (
        <Card className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            No categories set up yet — a supplier's category is now determined by its service lines. Open the{' '}
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className="underline font-medium hover:text-amber-900 dark:hover:text-amber-200"
            >
              Category Summary
            </button>{' '}
            tab to create some, then add subcategories under each supplier's Pricing Management tab.
          </p>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card border border-border p-1">
          <TabsTrigger value="list" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            All Suppliers
          </TabsTrigger>
          <TabsTrigger value="summary" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Category Summary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <BulkActionsBar count={selectedCount} labelSingular="supplier" labelPlural="suppliers" onDeselectAll={clear}>
            <Button variant="outline" size="sm" onClick={handleExportSelected}>
              <Download className="w-4 h-4 mr-2" />
              Export {selectedCount}
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Delete {selectedCount}
            </Button>
          </BulkActionsBar>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="Search by name, city, area or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 bg-card"
            />
            {isFetching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 animate-spin" />
            )}
          </div>

          {/* Active filters indicator */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 px-1">
              <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-full">
                <Filter className="w-3 h-3" />
                {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={clearFilters}>
                <FilterX className="w-3 h-3 mr-1" /> Clear all
              </Button>
            </div>
          )}

          {/* Table */}
          <Card className="bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                    </th>
                    <SortHeader
                      field="name"
                      label="Name"
                      sortField={sortField}
                      handleSort={handleSort}
                      filter={
                        <SupplierTextFilter
                          value={filters.name}
                          onChange={(v) => setFilters({ ...filters, name: v })}
                          placeholder="Filter by name..."
                        />
                      }
                      filterActive={!!filters.name}
                    />
                    <SortHeader
                      field="category"
                      label="Category"
                      sortField={sortField}
                      handleSort={handleSort}
                      filter={
                        <SupplierCategoryFilter
                          categories={categories}
                          selected={filters.category}
                          onChange={(v) => setFilters({ ...filters, category: v })}
                        />
                      }
                      filterActive={filters.category.length > 0}
                    />
                    <SortHeader
                      field="city"
                      label="City"
                      sortField={sortField}
                      handleSort={handleSort}
                      filter={
                        <SupplierTextFilter
                          value={filters.city}
                          onChange={(v) => setFilters({ ...filters, city: v })}
                          placeholder="Filter by city..."
                        />
                      }
                      filterActive={!!filters.city}
                    />
                    <SortHeader
                      field="rating"
                      label="Rating"
                      sortField={sortField}
                      handleSort={handleSort}
                      filter={
                        <SupplierRatingFilter
                          value={filters.rating}
                          onChange={(v) => setFilters({ ...filters, rating: v })}
                        />
                      }
                      filterActive={!!filters.rating?.length}
                    />
                    <SortHeader
                      field="area"
                      label="Area"
                      sortField={sortField}
                      handleSort={handleSort}
                      filter={
                        <SupplierTextFilter
                          value={filters.area}
                          onChange={(v) => setFilters({ ...filters, area: v })}
                          placeholder="Filter by area..."
                        />
                      }
                      filterActive={!!filters.area}
                    />
                    {extraColumns.map((col) => (
                      <th
                        key={col.key}
                        className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7 + extraColumns.length} className="text-center py-16 text-muted-foreground">
                        {searchTerm ? 'No suppliers match your search.' : 'No suppliers yet. Add your first supplier!'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((supplier) => {
                      const supplierCatIds = getSupplierCategoryIds(supplierCategoryMap, supplier.id);
                      return (
                        <tr
                          key={supplier.id}
                          className={`hover:bg-muted transition-colors cursor-pointer ${selectedIds.has(supplier.id) ? 'bg-blue-50/50 dark:bg-blue-950/50' : ''}`}
                          onClick={() => (window.location.href = createPageUrl(`SupplierDetails?id=${supplier.id}`))}
                        >
                          <td
                            className="px-4 py-3"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggle(supplier.id);
                            }}
                          >
                            <Checkbox checked={selectedIds.has(supplier.id)} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">{supplier.name}</div>
                            {supplier.contact_person && (
                              <div className="text-xs text-muted-foreground">{supplier.contact_person}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {supplierCatIds.length === 0 ? (
                                <span className="text-muted-foreground text-xs">—</span>
                              ) : (
                                supplierCatIds.map((catId) => {
                                  const catColor = getCategoryColor(catId);
                                  return (
                                    <Badge
                                      key={catId}
                                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                                      style={{
                                        backgroundColor: `${catColor}20`,
                                        color: catColor,
                                        border: `1px solid ${catColor}40`,
                                      }}
                                    >
                                      {getCategoryName(catId)}
                                    </Badge>
                                  );
                                })
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-sm">{supplier.city || '—'}</td>
                          <td className="px-4 py-3">
                            {supplier.rating ? (
                              <div className="flex items-center gap-1">
                                {typeof supplier.rating === 'number' ? (
                                  <>
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`w-3.5 h-3.5 ${i < supplier.rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground fill-slate-200'}`}
                                      />
                                    ))}
                                    <span className="text-xs text-muted-foreground ml-1">{supplier.rating}</span>
                                  </>
                                ) : (
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {formatHotelType(supplier.rating)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-sm">{supplier.area || '—'}</td>
                          {extraColumns.map((col) => (
                            <td key={col.key} className="px-4 py-3 text-muted-foreground text-sm">
                              {supplier.custom_fields?.[col.key] || '—'}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openModal(supplier)}>
                                <Edit className="w-4 h-4 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(supplier.id)}>
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-border bg-muted text-xs text-muted-foreground">
              {filtered.length} of {total} supplier{total !== 1 ? 's' : ''}
            </div>
          </Card>

          <PaginationControls
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </TabsContent>

        <TabsContent value="summary">
          <SupplierCategorySummary />
        </TabsContent>
      </Tabs>

      {/* Supplier Modal */}
      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Categories</Label>
              <p className="text-xs text-muted-foreground">
                Select the categories this supplier operates in. These drive filtering and where the supplier appears.
              </p>
              <div className="flex flex-wrap gap-2">
                {categories.length === 0 && (
                  <span className="text-sm text-muted-foreground">No categories configured yet.</span>
                )}
                {categories.map((cat) => {
                  const active = selectedCategoryIds.includes(cat.id);
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() =>
                        setSelectedCategoryIds((prev) =>
                          prev.includes(cat.id) ? prev.filter((id) => id !== cat.id) : [...prev, cat.id],
                        )
                      }
                      className="px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors"
                      style={
                        active
                          ? {
                              backgroundColor: `${cat.color || '#3b82f6'}20`,
                              color: cat.color || '#3b82f6',
                              borderColor: cat.color || '#3b82f6',
                            }
                          : { borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }
                      }
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g., Istanbul"
                />
              </div>
              <div className="space-y-2">
                <Label>Area / Region</Label>
                <Input
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  placeholder="e.g., Aegean Coast"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Rating</Label>
                <Select
                  value={formData.rating?.toString()}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      rating: /** @type {number|string} */ (isNaN(Number(v)) ? v : Number(v)),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOTEL_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={String(opt.value)} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://"
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <LocationSearch
                value={formData.address}
                onChange={(v) => setFormData({ ...formData, address: v })}
                onSelect={(item) =>
                  setFormData((prev) => ({
                    ...prev,
                    address: item.label,
                    city: prev.city || item.city,
                  }))
                }
                placeholder="Search address (OpenStreetMap)..."
              />
            </div>
            <div className="space-y-2">
              <Label>Pricing Information</Label>
              <Textarea
                value={formData.pricing_info}
                onChange={(e) => setFormData({ ...formData, pricing_info: e.target.value })}
                rows={2}
                placeholder="Package details, rates..."
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>

            {/* Extra column fields */}
            {extraColumns.length > 0 && (
              <div className="border-t pt-4 space-y-3">
                <Label className="text-foreground font-semibold">Custom Fields</Label>
                {extraColumns.map((col) => (
                  <div key={col.key} className="space-y-1">
                    <Label>{col.label}</Label>
                    <Input
                      value={formData.custom_fields?.[col.key] || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          custom_fields: { ...formData.custom_fields, [col.key]: e.target.value },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit">{editingSupplier ? 'Update' : 'Add'} Supplier</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <SupplierCsvImporter
        open={csvImporterOpen}
        onOpenChange={setCsvImporterOpen}
        categories={categories}
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: ['Supplier'] });
          queryClient.invalidateQueries({ queryKey: ['allSupplierSubcategories'] });
        }}
      />

      {/* Column Manager Modal (Admin only) */}
      <Dialog open={columnManagerOpen} onOpenChange={setColumnManagerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Extra Columns</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Default columns: Name, Category, City, Rating, Area. Add custom columns below.
            </p>
            <div className="space-y-2">
              {extraColumns.map((col) => (
                <div key={col.key} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="font-medium text-foreground">{col.label}</span>
                  <Button variant="ghost" size="icon" onClick={() => removeExtraColumn(col.key)}>
                    <X className="w-4 h-4 text-red-500 dark:text-red-300" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="New column name..."
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExtraColumn())}
              />
              <Button onClick={addExtraColumn}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setColumnManagerOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Permanently Delete {selectedCount} Supplier{selectedCount > 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>permanently delete</strong> all selected suppliers from the database. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Keep Suppliers</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isBulkDeleting ? 'Deleting...' : `Yes, Delete ${selectedCount} Supplier${selectedCount > 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
