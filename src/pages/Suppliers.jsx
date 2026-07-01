import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useExport } from '@/hooks/useExport';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Star, Search, Settings, X, ArrowUpDown, Upload, Filter, FilterX, Download } from 'lucide-react';
import SupplierCsvImporter from '../components/suppliers/SupplierCsvImporter';
import SupplierCategorySummary from '../components/suppliers/SupplierCategorySummary';
import { SupplierTextFilter, SupplierCategoryFilter, SupplierRatingFilter, SupplierFilterButton } from '../components/suppliers/SupplierFilters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkeletonTable } from '@/components/ui/skeletons';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { usePermissions } from '../components/permissions/PermissionContext';
import { showSuccess, showError } from '@/lib/toast';

// const DEFAULT_COLUMNS = ['name', 'category', 'city', 'rating', 'area'];

const SortHeader = ({ field, label, filter, filterActive, sortField, handleSort }) => (
  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider select-none">
    <div className="flex items-center gap-1">
      <span className="cursor-pointer hover:text-slate-800" onClick={() => handleSort(field)}>
        {label}
      </span>
      <ArrowUpDown className={`w-3 h-3 cursor-pointer ${sortField === field ? 'text-blue-600' : 'text-slate-300'}`} onClick={() => handleSort(field)} />
      {filter && <SupplierFilterButton active={filterActive}>{filter}</SupplierFilterButton>}
    </div>
  </th>
);

export default function Suppliers() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [csvImporterOpen, setCsvImporterOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [extraColumns, setExtraColumns] = useState(() => {
    try { return JSON.parse(localStorage.getItem('supplier_extra_columns') || '[]'); } catch { return []; }
  });
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [filters, setFilters] = useState({ name: '', category: [], city: '', area: '', rating: null });

  const activeFilterCount = [filters.name, filters.city, filters.area, filters.rating !== null, filters.category.length > 0].filter(Boolean).length;

  const clearFilters = () => setFilters({ name: '', category: [], city: '', area: '', rating: null });

  const [formData, setFormData] = useState({
    name: '', category_id: '', contact_person: '', email: '', phone: '',
    website: '', address: '', city: '', area: '', pricing_info: '', notes: '', rating: 5,
    custom_fields: {}
  });
  const queryClient = useQueryClient();
  const { exportCSV } = useExport();
  const { hasPermission } = usePermissions();
  const isAdmin = hasPermission('manage_users');

  const { data: suppliers = /** @type {any} */ ([]), isLoading } = /** @type {any} */ (useQuery({
    queryKey: ['suppliers'],
    queryFn: () => db.entities.Supplier.list()
  }));

  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['supplierCategories'],
    queryFn: () => db.entities.SupplierCategory.list()
  }));

  const createMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ data) => db.entities.Supplier.create(data),
    onSuccess: () => { showSuccess('Supplier created'); queryClient.invalidateQueries({ queryKey: ['suppliers'] }); closeModal(); },
    onError: (error) => showError('Failed to create supplier', error.message)
  }));

  const updateMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) => db.entities.Supplier.update(id, data),
    onSuccess: () => { showSuccess('Supplier updated'); queryClient.invalidateQueries({ queryKey: ['suppliers'] }); closeModal(); },
    onError: (error) => showError('Failed to update supplier', error.message)
  }));

  const deleteMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ id) => db.entities.Supplier.delete(id),
    onSuccess: () => { showSuccess('Supplier deleted'); queryClient.invalidateQueries({ queryKey: ['suppliers'] }); },
    onError: (error) => showError('Failed to delete supplier', error.message)
  }));

  const openModal = (supplier = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name || '',
        category_id: supplier.category_id || '',
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
        custom_fields: supplier.custom_fields || {}
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: '', category_id: categories[0]?.id || '', contact_person: '', email: '',
        phone: '', website: '', address: '', city: '', area: '', pricing_info: '', notes: '',
        rating: 5, custom_fields: {}
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditingSupplier(null); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier.id, data: formData });
    } else {
      createMutation.mutate(formData);
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
    const updated = extraColumns.filter(c => c.key !== key);
    setExtraColumns(updated);
    localStorage.setItem('supplier_extra_columns', JSON.stringify(updated));
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || '—';
  const getCategoryColor = (id) => categories.find(c => c.id === id)?.color || '#94a3b8';

  const filtered = suppliers
    .filter(s => {
      const searchMatch = searchTerm === '' ||
        s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.area?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCategoryName(s.category_id).toLowerCase().includes(searchTerm.toLowerCase());

      const nameMatch = !filters.name || s.name?.toLowerCase().includes(filters.name.toLowerCase());
      const categoryMatch = !filters.category?.length || filters.category.includes(s.category_id);
      const cityMatch = !filters.city || s.city?.toLowerCase().includes(filters.city.toLowerCase());
      const areaMatch = !filters.area || s.area?.toLowerCase().includes(filters.area.toLowerCase());
      const ratingMatch = !filters.rating?.length || filters.rating.includes(s.rating);

      return searchMatch && nameMatch && categoryMatch && cityMatch && areaMatch && ratingMatch;
    })
    .sort((a, b) => {
      let av = '', bv = '';
      if (sortField === 'category') { av = getCategoryName(a.category_id); bv = getCategoryName(b.category_id); }
      else if (sortField === 'rating') { av = a.rating || 0; bv = b.rating || 0; }
      else { av = a[sortField] || ''; bv = b[sortField] || ''; }
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
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Suppliers</h1>
          <p className="text-slate-600">Manage your travel supplier database</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportCSV(filtered, 'suppliers', [
            { label: 'Name', accessor: (s) => s.name },
            { label: 'Category', accessor: (s) => getCategoryName(s.category_id) },
            { label: 'Contact Person', accessor: (s) => s.contact_person },
            { label: 'Email', accessor: (s) => s.email },
            { label: 'Phone', accessor: (s) => s.phone },
            { label: 'City', accessor: (s) => s.city },
            { label: 'Area', accessor: (s) => s.area },
            { label: 'Rating', accessor: (s) => s.rating }
          ])}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => setColumnManagerOpen(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Columns
            </Button>
          )}
          <Button variant="outline" onClick={() => setCsvImporterOpen(true)} disabled={categories.length === 0}>
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button
            onClick={() => openModal()}
            className="bg-blue-600 hover:bg-blue-700 shadow-lg"
            disabled={categories.length === 0}
          >
            <Plus className="w-5 h-5 mr-2" />
            New Supplier
          </Button>
        </div>
      </div>

      {categories.length === 0 ? (
        <Card className="p-12 text-center bg-white shadow-md">
          <h3 className="text-xl font-bold text-slate-900 mb-2">Create categories first</h3>
          <p className="text-slate-600">Go to <Link to={createPageUrl('Categories')} className="text-blue-600 underline">Categories</Link> to set up supplier categories</p>
        </Card>
      ) : (
        <Tabs defaultValue="list" className="space-y-6">
          <TabsList className="bg-white border border-slate-200 p-1">
            <TabsTrigger value="list" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">All Suppliers</TabsTrigger>
            <TabsTrigger value="summary" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Category Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                placeholder="Search by name, city, area or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>

            {/* Active filters indicator */}
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-2 px-1">
                <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                  <Filter className="w-3 h-3" />
                  {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
                </div>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-slate-500" onClick={clearFilters}>
                  <FilterX className="w-3 h-3 mr-1" /> Clear all
                </Button>
              </div>
            )}

            {/* Table */}
            <Card className="bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <SortHeader
                        field="name"
                        label="Name"
                        sortField={sortField}
                        handleSort={handleSort}
                        filter={<SupplierTextFilter value={filters.name} onChange={v => setFilters({ ...filters, name: v })} placeholder="Filter by name..." />}
                        filterActive={!!filters.name}
                      />
                      <SortHeader
                        field="category"
                        label="Category"
                        sortField={sortField}
                        handleSort={handleSort}
                        filter={<SupplierCategoryFilter categories={categories} selected={filters.category} onChange={v => setFilters({ ...filters, category: v })} />}
                        filterActive={filters.category.length > 0}
                      />
                      <SortHeader
                        field="city"
                        label="City"
                        sortField={sortField}
                        handleSort={handleSort}
                        filter={<SupplierTextFilter value={filters.city} onChange={v => setFilters({ ...filters, city: v })} placeholder="Filter by city..." />}
                        filterActive={!!filters.city}
                      />
                      <SortHeader
                        field="rating"
                        label="Rating"
                        sortField={sortField}
                        handleSort={handleSort}
                        filter={<SupplierRatingFilter value={filters.rating} onChange={v => setFilters({ ...filters, rating: v })} />}
                        filterActive={!!filters.rating?.length}
                      />
                      <SortHeader
                        field="area"
                        label="Area"
                        sortField={sortField}
                        handleSort={handleSort}
                        filter={<SupplierTextFilter value={filters.area} onChange={v => setFilters({ ...filters, area: v })} placeholder="Filter by area..." />}
                        filterActive={!!filters.area}
                      />
                      {extraColumns.map(col => (
                        <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {col.label}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6 + extraColumns.length} className="text-center py-16 text-slate-500">
                          {searchTerm ? 'No suppliers match your search.' : 'No suppliers yet. Add your first supplier!'}
                        </td>
                      </tr>
                    ) : (
                      filtered.map(supplier => {
                        const catColor = getCategoryColor(supplier.category_id);
                        return (
                          <tr
                            key={supplier.id}
                            className="hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() => window.location.href = createPageUrl(`SupplierDetails?id=${supplier.id}`)}
                          >
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{supplier.name}</div>
                              {supplier.contact_person && (
                                <div className="text-xs text-slate-500">{supplier.contact_person}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                className="text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: `${catColor}20`, color: catColor, border: `1px solid ${catColor}40` }}
                              >
                                {getCategoryName(supplier.category_id)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-sm">{supplier.city || '—'}</td>
                            <td className="px-4 py-3">
                              {supplier.rating ? (
                                <div className="flex items-center gap-1">
                                  {[...Array(5)].map((_, i) => (
                                    <Star key={i} className={`w-3.5 h-3.5 ${i < supplier.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200 fill-slate-200'}`} />
                                  ))}
                                  <span className="text-xs text-slate-500 ml-1">{supplier.rating}</span>
                                </div>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-sm">{supplier.area || '—'}</td>
                            {extraColumns.map(col => (
                              <td key={col.key} className="px-4 py-3 text-slate-600 text-sm">
                                {supplier.custom_fields?.[col.key] || '—'}
                              </td>
                            ))}
                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openModal(supplier)}>
                                  <Edit className="w-4 h-4 text-slate-500" />
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
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
                {filtered.length} supplier{filtered.length !== 1 ? 's' : ''}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="summary">
            <SupplierCategorySummary />
          </TabsContent>
        </Tabs>
      )}

      {/* Supplier Modal */}
      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="e.g., Istanbul" />
              </div>
              <div className="space-y-2">
                <Label>Area / Region</Label>
                <Input value={formData.area} onChange={(e) => setFormData({ ...formData, area: e.target.value })} placeholder="e.g., Aegean Coast" />
              </div>
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Rating</Label>
                <Select value={formData.rating?.toString()} onValueChange={(v) => setFormData({ ...formData, rating: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[5, 4, 3, 2, 1].map(r => <SelectItem key={r} value={r.toString()}>{r} Stars</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="https://" />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Pricing Information</Label>
              <Textarea value={formData.pricing_info} onChange={(e) => setFormData({ ...formData, pricing_info: e.target.value })} rows={2} placeholder="Package details, rates..." />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>

            {/* Extra column fields */}
            {extraColumns.length > 0 && (
              <div className="border-t pt-4 space-y-3">
                <Label className="text-slate-700 font-semibold">Custom Fields</Label>
                {extraColumns.map(col => (
                  <div key={col.key} className="space-y-1">
                    <Label>{col.label}</Label>
                    <Input
                      value={formData.custom_fields?.[col.key] || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        custom_fields: { ...formData.custom_fields, [col.key]: e.target.value }
                      })}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingSupplier ? 'Update' : 'Add'} Supplier
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <SupplierCsvImporter
        open={csvImporterOpen}
        onOpenChange={setCsvImporterOpen}
        categories={categories}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['suppliers'] })}
      />

      {/* Column Manager Modal (Admin only) */}
      <Dialog open={columnManagerOpen} onOpenChange={setColumnManagerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Extra Columns</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-slate-600">Default columns: Name, Category, City, Rating, Area. Add custom columns below.</p>
            <div className="space-y-2">
              {extraColumns.map(col => (
                <div key={col.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="font-medium text-slate-800">{col.label}</span>
                  <Button variant="ghost" size="icon" onClick={() => removeExtraColumn(col.key)}>
                    <X className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="New column name..."
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExtraColumn())}
              />
              <Button onClick={addExtraColumn} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setColumnManagerOpen(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}