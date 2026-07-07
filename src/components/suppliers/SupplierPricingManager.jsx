import { db } from '@/lib/DbContext';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  Tag,
  Layers,
  Scan,
  Loader2,
  FileUp,
  ImageIcon,
  X,
  Star,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { showError, showSuccess } from '@/lib/toast';

const SEASON_COLORS = {
  all_year: 'bg-muted text-foreground',
  high_season: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
  low_season: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  peak: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300',
  custom: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300',
};

// Gates whether a price tier shows up in the B2B client catalog — suppliers
// can self-submit pricing via their portal (always starts 'pending'), so
// staff need a way to review and approve it here before clients see it.
const APPROVAL_STATUS = {
  pending: {
    label: 'Pending Approval',
    color: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300',
    icon: Clock,
  },
  approved: {
    label: 'Approved',
    color: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
    icon: AlertCircle,
  },
};

const UNIT_LABELS = {
  per_person: 'Per Person',
  per_night: 'Per Night',
  per_trip: 'Per Trip',
  per_hour: 'Per Hour',
  per_day: 'Per Day',
  per_group: 'Per Group',
  per_car: 'Per Car',
  flat_rate: 'Flat Rate',
};

const OCCUPANCY_OPTIONS = [
  { value: 'single', label: 'Single (1 guest)', minPax: 1, maxPax: 1 },
  { value: 'double', label: 'Double (2 guests)', minPax: 2, maxPax: 2 },
  { value: 'twin', label: 'Twin (2 guests)', minPax: 2, maxPax: 2 },
  { value: 'triple', label: 'Triple (3 guests)', minPax: 3, maxPax: 3 },
  { value: 'quad', label: 'Quad (4 guests)', minPax: 4, maxPax: 4 },
  { value: 'family', label: 'Family (2 adults + children)', minPax: 2, maxPax: 4 },
  { value: 'extra_bed', label: 'Extra Bed', minPax: 1, maxPax: 1 },
];

export default function SupplierPricingManager({ supplierId }) {
  const queryClient = useQueryClient();

  const { data: supplierCategories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierCategories'],
      queryFn: () => db.entities.SupplierCategory.list(),
    })
  );

  const { data: subcategories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierSubcategories', supplierId],
      queryFn: () => db.entities.SupplierSubcategory.filter({ supplier_id: supplierId }),
      enabled: !!supplierId,
    })
  );

  // Category now lives on each subcategory (service line), not on the
  // supplier — a supplier's "categories" are just the distinct set across
  // its subcategories. Used here to pick sensible pricing defaults.
  const subcategoryCategoryIds = new Set(subcategories.map((sc) => sc.category_id).filter(Boolean));
  const categoryNames = supplierCategories
    .filter((c) => subcategoryCategoryIds.has(c.id))
    .map((c) => c.name?.toLowerCase() || '');
  const isHotel = categoryNames.some((n) => n.includes('hotel'));
  const isTransfer = categoryNames.some((n) => n.includes('transfer'));
  const defaultUnit = isHotel ? 'per_night' : isTransfer ? 'per_car' : 'per_person';
  const defaultCurrency = isHotel ? 'EUR' : 'USD';

  const [activeTab, setActiveTab] = useState('subcategories');
  const [subcatModalOpen, setSubcatModalOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [editingSubcat, setEditingSubcat] = useState(null);
  const [editingPricing, setEditingPricing] = useState(null);
  const [pricingTypeFilter, setPricingTypeFilter] = useState('all');
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrSelectedRows, setOcrSelectedRows] = useState([]);

  const [subcatForm, setSubcatForm] = useState({ name: '', category_id: '', description: '', sort_order: 0 });

  const freshPricingForm = () => ({
    name: '',
    description: '',
    subcategory_id: '',
    service_id: '',
    base_price: 0,
    client_price: 0,
    currency: defaultCurrency,
    unit: defaultUnit,
    season_type: 'all_year',
    season_start: '',
    season_end: '',
    min_quantity: 1,
    max_quantity: '',
    markup_percentage: 0,
    notes: '',
    is_active: true,
    occupancy: '',
    pricing_type: 'individual',
    min_group_size: 12,
    car_capacity: '',
    image_url: '',
    is_featured: false,
    // Staff creating a price tier directly here is the review step — only
    // pricing submitted by suppliers through their own portal starts pending.
    approval_status: 'approved',
  });

  const [pricingForm, setPricingForm] = useState(freshPricingForm());
  const [imageUploading, setImageUploading] = useState(false);

  const handleImageUpload = async (file) => {
    if (!file) return;
    setImageUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setPricingForm((f) => ({ ...f, image_url: file_url }));
    } catch (err) {
      showError('Failed to upload photo', err.message);
    }
    setImageUploading(false);
  };

  const { data: pricings = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierPricings', supplierId],
      queryFn: () => db.entities.SupplierPricing.filter({ supplier_id: supplierId }),
      enabled: !!supplierId,
    })
  );

  // Subcategory mutations
  const createSubcatMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) =>
        db.entities.SupplierSubcategory.create({ ...data, supplier_id: supplierId }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['supplierSubcategories', supplierId] });
        queryClient.invalidateQueries({ queryKey: ['allSupplierSubcategories'] });
        setSubcatModalOpen(false);
        setSubcatForm({ name: '', category_id: '', description: '', sort_order: 0 });
      },
    })
  );

  const updateSubcatMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) =>
        db.entities.SupplierSubcategory.update(id, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['supplierSubcategories', supplierId] });
        queryClient.invalidateQueries({ queryKey: ['allSupplierSubcategories'] });
        setSubcatModalOpen(false);
        setEditingSubcat(null);
      },
    })
  );

  const deleteSubcatMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.SupplierSubcategory.delete(id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['supplierSubcategories', supplierId] });
        queryClient.invalidateQueries({ queryKey: ['allSupplierSubcategories'] });
      },
    })
  );

  // Pricing mutations
  const createPricingMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.SupplierPricing.create({ ...data, supplier_id: supplierId }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] });
        setPricingModalOpen(false);
        resetPricingForm();
      },
    })
  );

  const updatePricingMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) => db.entities.SupplierPricing.update(id, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] });
        setPricingModalOpen(false);
        setEditingPricing(null);
      },
    })
  );

  const deletePricingMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.SupplierPricing.delete(id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] }),
    })
  );

  const resetPricingForm = () => {
    setPricingForm(freshPricingForm());
  };

  const openSubcatModal = (subcat = null) => {
    if (subcat) {
      setEditingSubcat(subcat);
      setSubcatForm({
        name: subcat.name,
        category_id: subcat.category_id || '',
        description: subcat.description || '',
        sort_order: subcat.sort_order || 0,
      });
    } else {
      setEditingSubcat(null);
      setSubcatForm({ name: '', category_id: '', description: '', sort_order: 0 });
    }
    setSubcatModalOpen(true);
  };

  const openPricingModal = (pricing = null) => {
    if (pricing) {
      setEditingPricing(pricing);
      const computedClientPrice =
        pricing.client_price != null
          ? pricing.client_price
          : pricing.base_price * (1 + (pricing.markup_percentage || 0) / 100);
      setPricingForm({
        name: pricing.name,
        description: pricing.description || '',
        subcategory_id: pricing.subcategory_id || '',
        service_id: pricing.service_id || '',
        base_price: pricing.base_price,
        client_price: computedClientPrice,
        currency: pricing.currency || 'USD',
        unit: pricing.unit || 'per_person',
        season_type: pricing.season_type || 'all_year',
        season_start: pricing.season_start || '',
        season_end: pricing.season_end || '',
        min_quantity: pricing.min_quantity || 1,
        max_quantity: pricing.max_quantity || '',
        markup_percentage: pricing.markup_percentage || 0,
        notes: pricing.notes || '',
        is_active: pricing.is_active !== false,
        occupancy: pricing.occupancy || '',
        pricing_type: pricing.pricing_type || 'individual',
        min_group_size: pricing.min_group_size || 12,
        car_capacity: pricing.car_capacity || '',
        image_url: pricing.image_url || '',
        is_featured: pricing.is_featured || false,
        approval_status: pricing.approval_status || 'pending',
      });
    } else {
      setEditingPricing(null);
      resetPricingForm();
    }
    setPricingModalOpen(true);
  };

  const handleSubcatSubmit = (e) => {
    e.preventDefault();
    if (!subcatForm.category_id) {
      showError('Select a category for this subcategory');
      return;
    }
    if (editingSubcat) {
      updateSubcatMutation.mutate({ id: editingSubcat.id, data: subcatForm });
    } else {
      createSubcatMutation.mutate(subcatForm);
    }
  };

  const handlePricingSubmit = (e) => {
    e.preventDefault();
    const data = { ...pricingForm, max_quantity: pricingForm.max_quantity || null };
    if (editingPricing) {
      updatePricingMutation.mutate({ id: editingPricing.id, data });
    } else {
      createPricingMutation.mutate(data);
    }
  };

  const getSubcategoryName = (id) => subcategories.find((s) => s.id === id)?.name || '';
  //   const getServiceName = (id) => services.find(s => s.id === id)?.service_name || '';
  const getOccupancyLabel = (val) => OCCUPANCY_OPTIONS.find((o) => o.value === val)?.label || '';

  // Auto-generate name from subcategory + occupancy + season for hotels
  useEffect(() => {
    if (editingPricing) return;
    const parts = [];
    const subcatName = getSubcategoryName(pricingForm.subcategory_id);
    if (subcatName) parts.push(subcatName);
    if (isHotel && pricingForm.occupancy) {
      parts.push(
        getOccupancyLabel(pricingForm.occupancy)
          .replace(/\(.*\)/, '')
          .trim(),
      );
    }
    const seasonLabel = {
      all_year: '',
      high_season: 'High Season',
      low_season: 'Low Season',
      peak: 'Peak',
      custom:
        pricingForm.season_start && pricingForm.season_end
          ? `${pricingForm.season_start} ${pricingForm.season_end}`
          : '',
    }[pricingForm.season_type];
    if (seasonLabel) parts.push(seasonLabel);
    if (parts.length > 0) {
      setPricingForm((f) => ({ ...f, name: parts.join(' - ') }));
    }
  }, [
    pricingForm.subcategory_id,
    pricingForm.occupancy,
    pricingForm.season_type,
    pricingForm.season_start,
    pricingForm.season_end,
  ]);

  const clientPrice = (pricing) => {
    if (pricing.client_price != null && pricing.client_price > 0) return pricing.client_price;
    return pricing.base_price * (1 + (pricing.markup_percentage || 0) / 100);
  };

  const handleOcrUpload = async () => {
    if (!ocrFile) return;
    setOcrLoading(true);
    setOcrResult(null);
    try {
      const uploadResult = await db.integrations.Ocr.uploadFile(ocrFile);
      if (!uploadResult.success) throw new Error('Upload failed');
      const subcat = subcategories.find((s) => s.id === pricingForm.subcategory_id);
      const category = supplierCategories.find((c) => c.id === subcat?.category_id);
      const result = await db.integrations.Ocr.extract(uploadResult.file_path, 'tur+eng', true, category?.name);
      setOcrResult(result);
      if (result.parsed?.rows) {
        setOcrSelectedRows(result.parsed.rows.map((_, i) => i));
      }
    } catch (err) {
      setOcrResult({ error: err.message });
    }
    setOcrLoading(false);
  };

  const handleOcrImport = async () => {
    const selected = ocrResult.parsed?.rows?.filter((_, i) => ocrSelectedRows.includes(i)) || [];
    for (const row of selected) {
      for (const price of row.prices) {
        await db.entities.SupplierPricing.create({
          supplier_id: supplierId,
          name: row.name,
          base_price: price.price,
          currency: price.currency || defaultCurrency,
          unit: defaultUnit,
          season_type: price.season || 'all_year',
          occupancy: row.occupancy || '',
          pricing_type: 'individual',
          is_active: true,
        });
      }
    }
    queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] });
    setOcrModalOpen(false);
    setOcrFile(null);
    setOcrResult(null);
  };

  return (
    <Card className="p-6 bg-card shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600 dark:text-green-300" />
          Pricing Management
        </h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="subcategories">
            <Layers className="w-4 h-4 mr-2" />
            Subcategories ({subcategories.length})
          </TabsTrigger>
          <TabsTrigger value="pricing">
            <Tag className="w-4 h-4 mr-2" />
            Price Tiers ({pricings.length})
          </TabsTrigger>
        </TabsList>

        {/* Subcategories Tab */}
        <TabsContent value="subcategories">
          <div className="flex justify-end mb-4">
            <Button onClick={() => openSubcatModal()} size="sm" disabled={supplierCategories.length === 0}>
              <Plus className="w-4 h-4 mr-2" />
              Add Subcategory
            </Button>
          </div>

          {supplierCategories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No categories exist yet — create one on the Categories page first.
            </div>
          ) : subcategories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No subcategories yet. Add one to place this supplier under a category.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subcategories
                .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                .map((subcat) => (
                  <Card key={subcat.id} className="p-4 bg-muted group hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">{subcat.name}</h3>
                          {subcat.category_id && (
                            <Badge variant="outline" className="text-xs">
                              {supplierCategories.find((c) => c.id === subcat.category_id)?.name || 'Unknown'}
                            </Badge>
                          )}
                        </div>
                        {subcat.description && (
                          <p className="text-sm text-muted-foreground mt-1">{subcat.description}</p>
                        )}
                        <div className="text-xs text-muted-foreground mt-2">
                          {pricings.filter((p) => p.subcategory_id === subcat.id).length} price tiers
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => openSubcatModal(subcat)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteSubcatMutation.mutate(subcat.id)}>
                          <Trash2 className="w-4 h-4 text-red-500 dark:text-red-300" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <Button
                variant={pricingTypeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPricingTypeFilter('all')}
              >
                All ({pricings.length})
              </Button>
              <Button
                variant={pricingTypeFilter === 'individual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPricingTypeFilter('individual')}
                className={pricingTypeFilter === 'individual' ? 'bg-blue-600' : ''}
              >
                Individual
              </Button>
              <Button
                variant={pricingTypeFilter === 'group' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPricingTypeFilter('group')}
                className={pricingTypeFilter === 'group' ? 'bg-purple-600' : ''}
              >
                Group
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setOcrModalOpen(true);
                  setOcrFile(null);
                  setOcrResult(null);
                }}
                size="sm"
                variant="outline"
                className="border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
              >
                <Scan className="w-4 h-4 mr-2" />
                OCR Import
              </Button>
              <Button onClick={() => openPricingModal()} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Price Tier
              </Button>
            </div>
          </div>

          {(() => {
            const filtered = pricings.filter((p) => {
              if (pricingTypeFilter === 'all') return true;
              return (p.pricing_type || 'individual') === pricingTypeFilter;
            });
            return filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {pricingTypeFilter === 'all'
                  ? 'No price tiers yet. Add pricing with different rates for seasons and categories.'
                  : `No ${pricingTypeFilter} pricing tiers yet. Click "Add Price Tier" to create one.`}
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((pricing) => (
                  <Card
                    key={pricing.id}
                    className={`p-4 group hover:shadow-md transition-shadow ${!pricing.is_active ? 'opacity-50' : ''}`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      {pricing.image_url ? (
                        <img
                          src={pricing.image_url}
                          alt={pricing.name}
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-border"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border border-border">
                          <ImageIcon className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-foreground">{pricing.name}</h3>
                          {pricing.is_featured && (
                            <Star className="w-4 h-4 text-amber-500 dark:text-amber-300 fill-amber-500 flex-shrink-0" />
                          )}
                          <Badge className={SEASON_COLORS[pricing.season_type]}>
                            {pricing.season_type?.replace('_', ' ')}
                          </Badge>
                          {pricing.subcategory_id && (
                            <Badge variant="outline">{getSubcategoryName(pricing.subcategory_id)}</Badge>
                          )}
                          {pricing.occupancy && (
                            <Badge
                              variant="secondary"
                              className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            >
                              {getOccupancyLabel(pricing.occupancy)}
                            </Badge>
                          )}
                          {(pricing.pricing_type || 'individual') === 'group' && (
                            <Badge className="bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                              Group (min {pricing.min_group_size || 12} pax)
                            </Badge>
                          )}
                          {!pricing.is_active && <Badge variant="secondary">Inactive</Badge>}
                          {(() => {
                            const config = APPROVAL_STATUS[pricing.approval_status] || APPROVAL_STATUS.pending;
                            const Icon = config.icon;
                            return (
                              <Badge className={config.color}>
                                <Icon className="w-3 h-3 mr-1" />
                                {config.label}
                              </Badge>
                            );
                          })()}
                        </div>
                        {pricing.description && (
                          <p className="text-sm text-muted-foreground mb-2">{pricing.description}</p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4 text-green-600 dark:text-green-300" />
                            <span className="font-bold text-green-700 dark:text-green-300">
                              {pricing.currency} {pricing.base_price.toFixed(2)}
                            </span>
                            <span className="text-muted-foreground">({UNIT_LABELS[pricing.unit]})</span>
                          </div>
                          {pricing.unit === 'per_car' && pricing.car_capacity && (
                            <span className="text-xs text-muted-foreground">up to {pricing.car_capacity} pax/car</span>
                          )}
                          {pricing.markup_percentage > 0 && (
                            <div className="text-muted-foreground">
                              Client:{' '}
                              <span className="font-semibold text-blue-600 dark:text-blue-300">
                                ${clientPrice(pricing).toFixed(2)}
                              </span>
                              <span className="text-xs ml-1">(+{pricing.markup_percentage}%)</span>
                            </div>
                          )}
                          {pricing.season_type === 'custom' && pricing.season_start && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              {pricing.season_start} - {pricing.season_end}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {pricing.approval_status !== 'approved' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Approve for B2B catalog"
                            onClick={() => {
                              updatePricingMutation.mutate({ id: pricing.id, data: { approval_status: 'approved' } });
                              showSuccess('Price tier approved', 'Now visible in the B2B client catalog');
                            }}
                          >
                            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-300" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => openPricingModal(pricing)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deletePricingMutation.mutate(pricing.id)}>
                          <Trash2 className="w-4 h-4 text-red-500 dark:text-red-300" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* Subcategory Modal */}
      <Dialog open={subcatModalOpen} onOpenChange={setSubcatModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSubcat ? 'Edit Subcategory' : 'Add Subcategory'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubcatSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="subcat_name">Name *</Label>
              <Input
                id="subcat_name"
                value={subcatForm.name}
                onChange={(e) => setSubcatForm({ ...subcatForm, name: e.target.value })}
                placeholder="e.g., Economy, Business, Deluxe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={subcatForm.category_id}
                onValueChange={(v) => setSubcatForm({ ...subcatForm, category_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {supplierCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Determines which category this supplier shows up under (e.g. Guided Tours, Transfers).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcat_desc">Description</Label>
              <Textarea
                id="subcat_desc"
                value={subcatForm.description}
                onChange={(e) => setSubcatForm({ ...subcatForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={subcatForm.sort_order}
                onChange={(e) => setSubcatForm({ ...subcatForm, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setSubcatModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingSubcat ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pricing Modal */}
      <Dialog open={pricingModalOpen} onOpenChange={setPricingModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPricing ? 'Edit Price Tier' : 'Add Price Tier'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePricingSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pricing_name">Name *</Label>
                <Input
                  id="pricing_name"
                  value={pricingForm.name}
                  onChange={(e) => setPricingForm({ ...pricingForm, name: e.target.value })}
                  placeholder="e.g., Standard Room - Peak Season"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Subcategory</Label>
                <Select
                  value={pricingForm.subcategory_id}
                  onValueChange={(v) => setPricingForm({ ...pricingForm, subcategory_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {subcategories.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={pricingForm.description}
                onChange={(e) => setPricingForm({ ...pricingForm, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Photo (shown in the B2B client catalog)</Label>
              {pricingForm.image_url ? (
                <div className="relative w-32 h-32">
                  <img
                    src={pricingForm.image_url}
                    alt=""
                    className="w-32 h-32 rounded-lg object-cover border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setPricingForm({ ...pricingForm, image_url: '' })}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-card rounded-full border border-border shadow flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <X className="w-3.5 h-3.5 text-red-500 dark:text-red-300" />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer inline-block">
                  <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors">
                    {imageUploading ? (
                      <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                    ) : (
                      <>
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Upload photo</span>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={imageUploading}
                    onChange={(e) => handleImageUpload(e.target.files[0])}
                  />
                </label>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 items-end">
              <div className="space-y-2">
                <Label>B2B Approval Status</Label>
                <Select
                  value={pricingForm.approval_status}
                  onValueChange={(v) => setPricingForm({ ...pricingForm, approval_status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending Approval</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only "Approved" tiers are visible in the B2B client catalog.
                </p>
              </div>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/50 cursor-pointer h-fit">
                <Switch
                  checked={pricingForm.is_featured}
                  onCheckedChange={(v) => setPricingForm({ ...pricingForm, is_featured: v })}
                />
                <span className="flex items-center gap-1.5 text-sm text-foreground">
                  <Star
                    className={`w-4 h-4 ${pricingForm.is_featured ? 'text-amber-500 dark:text-amber-300 fill-amber-500' : 'text-muted-foreground'}`}
                  />
                  Feature in carousel
                </span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={pricingForm.currency}
                  onValueChange={(v) => setPricingForm({ ...pricingForm, currency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="JPY">JPY</SelectItem>
                    <SelectItem value="TRY">TRY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={pricingForm.unit} onValueChange={(v) => setPricingForm({ ...pricingForm, unit: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg border border-border">
              <div className="space-y-2">
                <Label className="text-foreground font-semibold">Supplier Price (Cost) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {pricingForm.currency}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    className="pl-12"
                    value={pricingForm.base_price}
                    onChange={(e) => {
                      const base = parseFloat(e.target.value) || 0;
                      setPricingForm({ ...pricingForm, base_price: base });
                    }}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">What you pay the supplier</p>
              </div>
              <div className="space-y-2">
                <Label className="text-blue-700 dark:text-blue-300 font-semibold">Client Price (Sell) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {pricingForm.currency}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    className="pl-12 border-blue-300 dark:border-blue-800 focus:ring-blue-400"
                    value={pricingForm.client_price}
                    onChange={(e) => {
                      const client = parseFloat(e.target.value) || 0;
                      const markup =
                        pricingForm.base_price > 0
                          ? ((client - pricingForm.base_price) / pricingForm.base_price) * 100
                          : 0;
                      setPricingForm({
                        ...pricingForm,
                        client_price: client,
                        markup_percentage: Math.round(markup * 100) / 100,
                      });
                    }}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  What you charge the client
                  {pricingForm.base_price > 0 && pricingForm.client_price > 0 && (
                    <span className="ml-1 font-medium text-blue-600 dark:text-blue-300">
                      ({pricingForm.markup_percentage > 0 ? '+' : ''}
                      {pricingForm.markup_percentage.toFixed(1)}% margin)
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Season Type</Label>
                <Select
                  value={pricingForm.season_type}
                  onValueChange={(v) => setPricingForm({ ...pricingForm, season_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_year">All Year</SelectItem>
                    <SelectItem value="high_season">High Season</SelectItem>
                    <SelectItem value="low_season">Low Season</SelectItem>
                    <SelectItem value="peak">Peak</SelectItem>
                    <SelectItem value="custom">Custom Dates</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {pricingForm.season_type === 'custom' && (
                <>
                  <div className="space-y-2">
                    <Label>Season Start</Label>
                    <Input
                      type="date"
                      value={pricingForm.season_start}
                      onChange={(e) => setPricingForm({ ...pricingForm, season_start: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Season End</Label>
                    <Input
                      type="date"
                      value={pricingForm.season_end}
                      onChange={(e) => setPricingForm({ ...pricingForm, season_end: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>

            {isHotel && (
              <div className="space-y-2">
                <Label>Occupancy</Label>
                <Select
                  value={pricingForm.occupancy}
                  onValueChange={(v) => {
                    const occ = OCCUPANCY_OPTIONS.find((o) => o.value === v);
                    setPricingForm({
                      ...pricingForm,
                      occupancy: v,
                      min_quantity: occ ? occ.minPax : 1,
                      max_quantity: occ ? String(occ.maxPax) : '',
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select occupancy..." />
                  </SelectTrigger>
                  <SelectContent>
                    {OCCUPANCY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Pricing Type</Label>
              <Select
                value={pricingForm.pricing_type}
                onValueChange={(v) => setPricingForm({ ...pricingForm, pricing_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {pricingForm.pricing_type === 'group' && (
              <div className="space-y-2">
                <Label>Min. Group Size</Label>
                <Input
                  type="number"
                  min={2}
                  value={pricingForm.min_group_size}
                  onChange={(e) => setPricingForm({ ...pricingForm, min_group_size: parseInt(e.target.value) || 12 })}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum number of people for this group rate (default: 12)
                </p>
              </div>
            )}

            {isTransfer && (
              <div className="space-y-2">
                <Label>Car Capacity (max pax)</Label>
                <Input
                  type="number"
                  min={1}
                  value={pricingForm.car_capacity}
                  onChange={(e) => setPricingForm({ ...pricingForm, car_capacity: e.target.value })}
                  placeholder="e.g., 4"
                />
                <p className="text-xs text-muted-foreground">Maximum number of passengers per vehicle</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isHotel ? 'Min Pax' : 'Min Quantity'}</Label>
                <Input
                  type="number"
                  value={pricingForm.min_quantity}
                  onChange={(e) => setPricingForm({ ...pricingForm, min_quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>{isHotel ? 'Max Pax' : 'Max Quantity'}</Label>
                <Input
                  type="number"
                  value={pricingForm.max_quantity}
                  onChange={(e) => setPricingForm({ ...pricingForm, max_quantity: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={pricingForm.notes}
                onChange={(e) => setPricingForm({ ...pricingForm, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setPricingModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingPricing ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* OCR Import Modal */}
      <Dialog
        open={ocrModalOpen}
        onOpenChange={(v) => {
          setOcrModalOpen(v);
          if (!v) {
            setOcrFile(null);
            setOcrResult(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scan className="w-5 h-5 text-purple-600 dark:text-purple-300" />
              OCR Import Pricing
            </DialogTitle>
          </DialogHeader>

          {!ocrResult ? (
            <div className="space-y-4 mt-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                {ocrFile ? (
                  <div className="space-y-3">
                    <FileUp className="w-12 h-12 text-green-500 dark:text-green-300 mx-auto" />
                    <p className="font-medium text-foreground">{ocrFile.name}</p>
                    <p className="text-sm text-muted-foreground">{(ocrFile.size / 1024).toFixed(1)} KB</p>
                    <Button variant="outline" onClick={() => setOcrFile(null)}>
                      Choose Different File
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <FileUp className="w-12 h-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">Upload a pricing table image or PDF</p>
                    <p className="text-sm text-muted-foreground">Supports JPG, PNG, PDF (up to 20MB)</p>
                    <label className="cursor-pointer">
                      <Button variant="outline" className="relative">
                        Choose File
                        <input
                          type="file"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          accept="image/*,application/pdf"
                          onChange={(e) => setOcrFile(e.target.files[0])}
                        />
                      </Button>
                    </label>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setOcrModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleOcrUpload}
                  disabled={!ocrFile || ocrLoading}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {ocrLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing OCR...
                    </>
                  ) : (
                    <>
                      <Scan className="w-4 h-4 mr-2" />
                      Extract Pricing
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : ocrResult.error ? (
            <div className="space-y-4 mt-4">
              <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
                <p className="font-semibold">OCR Error</p>
                <p className="text-sm mt-1">{ocrResult.error}</p>
                {ocrResult.raw && (
                  <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/40 rounded text-xs max-h-40 overflow-auto">
                    {ocrResult.raw}
                  </pre>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setOcrResult(null);
                    setOcrFile(null);
                  }}
                >
                  Try Again
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              {/* Raw OCR Text */}
              <details className="border border-border rounded-lg">
                <summary className="px-4 py-2 bg-muted cursor-pointer text-sm font-medium text-foreground">
                  Raw OCR Text ({ocrResult.text?.length || 0} chars)
                </summary>
                <pre className="p-4 text-xs text-muted-foreground max-h-60 overflow-auto whitespace-pre-wrap font-mono">
                  {ocrResult.text}
                </pre>
              </details>

              {/* Parsed Rows */}
              {ocrResult.parsed?.rows?.length > 0 ? (
                <div>
                  <h4 className="font-semibold text-foreground mb-2">
                    Detected Pricing ({ocrResult.parsed.rows.length} rows)
                  </h4>
                  <div className="space-y-2">
                    {ocrResult.parsed.rows.map((row, idx) => (
                      <label
                        key={idx}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${ocrSelectedRows.includes(idx) ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800' : 'bg-muted border-border'}`}
                      >
                        <input
                          type="checkbox"
                          checked={ocrSelectedRows.includes(idx)}
                          onChange={() => {
                            setOcrSelectedRows((prev) =>
                              prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
                            );
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-foreground">{row.name}</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {row.prices.map((p, pi) => (
                              <span key={pi} className="text-xs bg-card px-2 py-1 rounded border text-foreground">
                                {p.currency} {p.price.toFixed(2)}
                                {p.season ? ` (${p.season})` : ''}
                              </span>
                            ))}
                          </div>
                          {row.occupancy && (
                            <span className="text-xs text-muted-foreground mt-1 block">
                              Occupancy: {getOccupancyLabel(String(row.occupancy))}
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-300">
                  <p className="font-semibold">No pricing data detected</p>
                  <p className="text-sm mt-1">
                    The OCR extracted text but could not identify pricing rows. Try a clearer image or enter prices
                    manually.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setOcrModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleOcrImport}
                  disabled={ocrSelectedRows.length === 0}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Import {ocrSelectedRows.length} Pricing Tier{ocrSelectedRows.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
