import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { showSuccess, showError } from '@/lib/toast';
import { DollarSign, Plus, Edit, Trash2, Copy, Check, XCircle, Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

const UNIT_LABEL_KEYS = {
  per_person: 'supplierPricingManager.unitPerPerson',
  per_night: 'supplierPricingManager.unitPerNight',
  per_trip: 'supplierPricingManager.unitPerTrip',
  per_hour: 'supplierPricingManager.unitPerHour',
  per_day: 'supplierPricingManager.unitPerDay',
  per_group: 'supplierPricingManager.unitPerGroup',
  flat_rate: 'supplierPricingManager.unitFlatRate',
};

const SEASON_LABEL_KEYS = {
  all_year: 'supplierPricingManager.seasonAllYear',
  high_season: 'supplierPricingManager.seasonHigh',
  low_season: 'supplierPricingManager.seasonLow',
  peak: 'supplierPricingManager.seasonPeak',
  custom: 'supplierPricingManager.seasonCustom',
};

const OCCUPANCY_OPTION_KEYS = [
  { value: '', labelKey: 'supplierPricingManager.occNone' },
  { value: 'single', labelKey: 'supplierPricingManager.occSingle' },
  { value: 'double', labelKey: 'supplierPricingManager.occDouble' },
  { value: 'twin', labelKey: 'supplierPricingManager.occTwin' },
  { value: 'triple', labelKey: 'supplierPricingManager.occTriple' },
  { value: 'quad', labelKey: 'supplierPricingManager.occQuad' },
  { value: 'family', labelKey: 'supplierPricingManager.occFamily' },
  { value: 'extra_bed', labelKey: 'supplierPricingManager.occExtraBed' },
];

const CAR_CATEGORY_OPTION_KEYS = [
  { value: 'economy', labelKey: 'supplierPricingManager.carEconomy' },
  { value: 'compact', labelKey: 'supplierPricingManager.carCompact' },
  { value: 'intermediate', labelKey: 'supplierPricingManager.carIntermediate' },
  { value: 'standard', labelKey: 'supplierPricingManager.carStandard' },
  { value: 'full_size', labelKey: 'supplierPricingManager.carFullSize' },
  { value: 'premium', labelKey: 'supplierPricingManager.carPremium' },
  { value: 'luxury', labelKey: 'supplierPricingManager.carLuxury' },
  { value: 'suv', labelKey: 'supplierPricingManager.carSuv' },
  { value: 'minivan', labelKey: 'supplierPricingManager.carMinivan' },
  { value: 'convertible', labelKey: 'supplierPricingManager.carConvertible' },
];

const MEAL_TREATMENT_OPTION_KEYS = [
  { value: '', labelKey: 'supplierPricingManager.mealNone' },
  { value: 'RO', labelKey: 'supplierPricingManager.mealRO' },
  { value: 'BB', labelKey: 'supplierPricingManager.mealBB' },
  { value: 'HB', labelKey: 'supplierPricingManager.mealHB' },
  { value: 'FB', labelKey: 'supplierPricingManager.mealFB' },
  { value: 'AI', labelKey: 'supplierPricingManager.mealAI' },
  { value: 'UAI', labelKey: 'supplierPricingManager.mealUAI' },
];

const APPROVAL_BADGE_CONFIG = {
  pending: {
    labelKey: 'supplierPricingManager.approvalPending',
    class: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300',
  },
  approved: {
    labelKey: 'supplierPricingManager.approvalApproved',
    class: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  },
  rejected: {
    labelKey: 'supplierPricingManager.approvalRejected',
    class: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
  },
};

const DURATION_UNIT_OPTIONS = [
  { value: 'hours', labelKey: 'supplierPricingManager.durationHours' },
  { value: 'days', labelKey: 'supplierPricingManager.durationDays' },
];

const EMPTY_FORM = {
  name: '',
  description: '',
  base_price: '',
  client_price: '',
  currency: 'USD',
  unit: 'per_person',
  season_type: 'all_year',
  season_start: '',
  season_end: '',
  min_quantity: 1,
  max_quantity: '',
  occupancy: '',
  meal_treatment: '',
  car_category: '',
  daily_rate: '',
  drop_off_surcharge: '',
  insurance_surcharge: '',
  duration_value: '',
  duration_unit: 'hours',
  max_capacity: '',
  notes: '',
};

export default function SupplierPricingManager({
  supplierId,
  categoryName = '',
  categories = /** @type {any} */ ([]),
}) {
  const { t } = useT();
  const [activeCategory, setActiveCategory] = useState(/** @type {any} */ (null));
  const effectiveCategoryName = activeCategory?.name || categoryName || categories?.[0]?.name || '';
  const catName = effectiveCategoryName.toLowerCase();
  const isHotel =
    catName.includes('hotel') ||
    catName.includes('lodging') ||
    catName.includes('accommodation') ||
    catName.includes('resort');
  const isCarRental =
    catName.includes('rent a car') || catName.includes('car rental') || catName.includes('rental car');
  const isGuidedTour =
    catName.includes('tour') ||
    catName.includes('excursion') ||
    catName.includes('guided') ||
    catName.includes('activity');
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPricing, setEditingPricing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [duplicateCheckError, setDuplicateCheckError] = useState('');

  const { data: pricings = [] } = useQuery({
    queryKey: ['supplierPricings', supplierId],
    queryFn: () => db.entities.SupplierPricing.filter({ supplier_id: supplierId }),
    enabled: !!supplierId,
  });

  const createMutation = useMutation({
    mutationFn: (/** @type {any} */ data) =>
      db.entities.SupplierPricing.create({
        ...data,
        supplier_id: supplierId,
        base_price: parseFloat(data.base_price) || 0,
        client_price: data.client_price ? parseFloat(data.client_price) : null,
        min_quantity: parseInt(data.min_quantity) || 1,
        max_quantity: data.max_quantity ? parseInt(data.max_quantity) : null,
        duration_value: data.duration_value ? parseFloat(data.duration_value) : null,
        max_capacity: data.max_capacity ? parseInt(data.max_capacity) : null,
        is_active: true,
        approval_status: 'pending',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] });
      closeModal();
      showSuccess(t('supplierPricingManager.successCreated'));
    },
    onError: (error) => showError(t('supplierPricingManager.errorCreate'), error.message),
  });

  const updateMutation = useMutation({
    mutationFn: (/** @type {any} */ { id, data }) =>
      db.entities.SupplierPricing.update(id, {
        ...data,
        base_price: parseFloat(data.base_price) || 0,
        client_price: data.client_price ? parseFloat(data.client_price) : null,
        min_quantity: parseInt(data.min_quantity) || 1,
        max_quantity: data.max_quantity ? parseInt(data.max_quantity) : null,
        duration_value: data.duration_value ? parseFloat(data.duration_value) : null,
        max_capacity: data.max_capacity ? parseInt(data.max_capacity) : null,
        approval_status: 'pending',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] });
      closeModal();
      showSuccess(t('supplierPricingManager.successUpdated'));
    },
    onError: (error) => showError(t('supplierPricingManager.errorUpdate'), error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (/** @type {any} */ id) => db.entities.SupplierPricing.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] });
      showSuccess(t('supplierPricingManager.successDeleted'));
    },
    onError: (error) => showError(t('supplierPricingManager.errorDelete'), error.message),
  });

  const approveMutation = useMutation({
    mutationFn: (/** @type {any} */ { id }) => db.entities.SupplierPricing.update(id, { approval_status: 'approved' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] });
      showSuccess(t('supplierPricingManager.successApproved'));
    },
    onError: (error) => showError(t('supplierPricingManager.errorApprove'), error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (/** @type {any} */ { id }) => db.entities.SupplierPricing.update(id, { approval_status: 'rejected' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] });
      showSuccess(t('supplierPricingManager.successRejected'));
    },
    onError: (error) => showError(t('supplierPricingManager.errorReject'), error.message),
  });

  function checkDuplicate(excludeId) {
    const sameName = pricings.find(
      (p) =>
        p.name.toLowerCase() === form.name.toLowerCase() &&
        p.id !== excludeId &&
        p.occupancy === form.occupancy &&
        p.meal_treatment === form.meal_treatment &&
        p.season_type === form.season_type &&
        (form.season_type !== 'custom' || (p.season_start === form.season_start && p.season_end === form.season_end)),
    );
    if (sameName) {
      setDuplicateCheckError(t('supplierPricingManager.duplicateErrorTemplate', { name: sameName.name }));
      return true;
    }
    setDuplicateCheckError('');
    return false;
  }

  const openCreateModal = () => {
    setEditingPricing(null);
    setForm({ ...EMPTY_FORM });
    setDuplicateCheckError('');
    setModalOpen(true);
  };

  const openEditModal = (pricing) => {
    setEditingPricing(pricing);
    setForm({
      name: pricing.name || '',
      description: pricing.description || '',
      base_price: pricing.base_price?.toString() || '',
      client_price: pricing.client_price?.toString() || '',
      currency: pricing.currency || 'USD',
      unit: pricing.unit || 'per_person',
      season_type: pricing.season_type || 'all_year',
      season_start: pricing.season_start || '',
      season_end: pricing.season_end || '',
      min_quantity: pricing.min_quantity || 1,
      max_quantity: pricing.max_quantity?.toString() || '',
      occupancy: pricing.occupancy || '',
      meal_treatment: pricing.meal_treatment || '',
      car_category: pricing.car_category || '',
      daily_rate: pricing.daily_rate?.toString() || '',
      drop_off_surcharge: pricing.drop_off_surcharge?.toString() || '',
      insurance_surcharge: pricing.insurance_surcharge?.toString() || '',
      duration_value: pricing.duration_value?.toString() || '',
      duration_unit: pricing.duration_unit || 'hours',
      max_capacity: pricing.max_capacity?.toString() || '',
      notes: pricing.notes || '',
    });
    setDuplicateCheckError('');
    setModalOpen(true);
  };

  const openDuplicateModal = (pricing) => {
    setEditingPricing(null);
    setForm({
      name: pricing.name ? `${pricing.name} (copy)` : '',
      description: pricing.description || '',
      base_price: pricing.base_price?.toString() || '',
      client_price: pricing.client_price?.toString() || '',
      currency: pricing.currency || 'USD',
      unit: pricing.unit || 'per_person',
      season_type: pricing.season_type || 'all_year',
      season_start: pricing.season_start || '',
      season_end: pricing.season_end || '',
      min_quantity: pricing.min_quantity || 1,
      max_quantity: pricing.max_quantity?.toString() || '',
      occupancy: pricing.occupancy || '',
      meal_treatment: pricing.meal_treatment || '',
      car_category: pricing.car_category || '',
      daily_rate: pricing.daily_rate?.toString() || '',
      drop_off_surcharge: pricing.drop_off_surcharge?.toString() || '',
      insurance_surcharge: pricing.insurance_surcharge?.toString() || '',
      duration_value: pricing.duration_value?.toString() || '',
      duration_unit: pricing.duration_unit || 'hours',
      max_capacity: pricing.max_capacity?.toString() || '',
      notes: pricing.notes || '',
    });
    setDuplicateCheckError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPricing(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (checkDuplicate(editingPricing?.id)) return;
    if (editingPricing) {
      updateMutation.mutate({ id: editingPricing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const seasonType = form.season_type || 'all_year';

  const getApprovalBadge = (status) => {
    const config = APPROVAL_BADGE_CONFIG[status] || APPROVAL_BADGE_CONFIG.pending;
    return <Badge className={config.class}>{t(config.labelKey)}</Badge>;
  };

  return (
    <div>
      <Card className="p-6 bg-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">{t('supplierPricingManager.pricingManagementTitle')}</h3>
          <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> {t('supplierPricingManager.addPricingTier')}
          </Button>
        </div>

        {categories?.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map((cat) => {
              const active = (activeCategory?.id || categoryName || categories[0]?.name) === (cat.id || cat.name);
              return (
                <button
                  type="button"
                  key={cat.id || cat.name}
                  onClick={() => setActiveCategory(cat)}
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
        )}

        {pricings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('supplierPricingManager.noPricingTiersYet')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pricings.map((pricing) => (
              <div
                key={pricing.id}
                className="p-4 border border-border rounded-lg hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-foreground">{pricing.name}</h4>
                      {getApprovalBadge(pricing.approval_status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
                      <span className="font-semibold text-green-700 dark:text-green-300">
                        ${pricing.base_price?.toFixed(2)}{' '}
                        <span className="font-normal text-muted-foreground">
                          {t('supplierPricingManager.baseSuffix')}
                        </span>
                      </span>
                      {pricing.client_price != null && (
                        <span className="font-semibold text-blue-700 dark:text-blue-300">
                          ${pricing.client_price?.toFixed(2)}{' '}
                          <span className="font-normal text-muted-foreground">
                            {t('supplierPricingManager.sellSuffix')}
                          </span>
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {SEASON_LABEL_KEYS[pricing.season_type]
                          ? t(SEASON_LABEL_KEYS[pricing.season_type])
                          : pricing.season_type}
                      </Badge>
                      {pricing.season_start && pricing.season_end && (
                        <span className="text-xs text-muted-foreground">
                          {pricing.season_start} → {pricing.season_end}
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {UNIT_LABEL_KEYS[pricing.unit] ? t(UNIT_LABEL_KEYS[pricing.unit]) : pricing.unit}
                      </Badge>
                      {pricing.occupancy && (
                        <Badge variant="secondary" className="text-xs">
                          {(() => {
                            const opt = OCCUPANCY_OPTION_KEYS.find((o) => o.value === pricing.occupancy);
                            return opt ? t(opt.labelKey) : pricing.occupancy;
                          })()}
                        </Badge>
                      )}
                      {pricing.meal_treatment && (
                        <Badge variant="secondary" className="text-xs">
                          {(() => {
                            const opt = MEAL_TREATMENT_OPTION_KEYS.find((o) => o.value === pricing.meal_treatment);
                            return opt ? t(opt.labelKey) : pricing.meal_treatment;
                          })()}
                        </Badge>
                      )}
                      {pricing.duration_value != null && (
                        <Badge variant="secondary" className="text-xs">
                          {pricing.duration_value}{' '}
                          {t(
                            pricing.duration_unit === 'days'
                              ? 'supplierPricingManager.durationDays'
                              : 'supplierPricingManager.durationHours',
                          )}
                        </Badge>
                      )}
                      {pricing.max_capacity != null && (
                        <Badge variant="secondary" className="text-xs">
                          {t('supplierPricingManager.maxCapacityBadge', { count: pricing.max_capacity })}
                        </Badge>
                      )}
                    </div>
                    {pricing.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{pricing.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-4 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDuplicateModal(pricing)}
                      title={t('tripCard.duplicate')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditModal(pricing)} title={t('common.edit')}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    {pricing.approval_status === 'pending' && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => approveMutation.mutate({ id: pricing.id })}
                          title={t('supplierPricingManager.approveTitle')}
                        >
                          <Check className="w-4 h-4 text-green-600 dark:text-green-300" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => rejectMutation.mutate({ id: pricing.id })}
                          title={t('supplierPricingManager.rejectTitle')}
                        >
                          <XCircle className="w-4 h-4 text-red-600 dark:text-red-300" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(pricing.id)}
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4 text-red-500 dark:text-red-300" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPricing
                ? t('supplierPricingManager.editPricingTierTitle')
                : t('supplierPricingManager.addPricingTier')}
            </DialogTitle>
            {!editingPricing && (
              <DialogDescription>{t('supplierPricingManager.duplicateWarningDesc')}</DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('supplierPricingManager.nameLabel')}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder={t('supplierPricingManager.namePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('supplierPricingManager.currencyLabel')}</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="TRY">TRY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('supplierPricingManager.basePriceLabel')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.base_price}
                  onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t('supplierPricingManager.clientSellPriceLabel')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.client_price}
                  onChange={(e) => setForm({ ...form, client_price: e.target.value })}
                  placeholder={t('supplierPricingManager.clientSellPricePlaceholder')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('supplierPricingManager.unitLabel')}</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_LABEL_KEYS).map(([key, labelKey]) => (
                      <SelectItem key={key} value={key}>
                        {t(labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('supplierPricingManager.seasonLabel')}</Label>
                <Select value={seasonType} onValueChange={(v) => setForm({ ...form, season_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEASON_LABEL_KEYS).map(([key, labelKey]) => (
                      <SelectItem key={key} value={key}>
                        {t(labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {seasonType === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('supplierPricingManager.seasonStartLabel')}</Label>
                  <Input
                    type="date"
                    value={form.season_start}
                    onChange={(e) => setForm({ ...form, season_start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('supplierPricingManager.seasonEndLabel')}</Label>
                  <Input
                    type="date"
                    value={form.season_end}
                    onChange={(e) => setForm({ ...form, season_end: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('supplierPricingManager.minQuantityLabel')}</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.min_quantity}
                  onChange={(e) => setForm({ ...form, min_quantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('supplierPricingManager.maxQuantityLabel')}</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.max_quantity}
                  onChange={(e) => setForm({ ...form, max_quantity: e.target.value })}
                  placeholder={t('supplierPricingManager.maxQuantityPlaceholder')}
                />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">
                {t('supplierPricingManager.hotelPricingOptionsTitle')}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('supplierPricingManager.occupancyLabel')}</Label>
                  <Select value={form.occupancy} onValueChange={(v) => setForm({ ...form, occupancy: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('supplierPricingManager.selectOccupancyPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {OCCUPANCY_OPTION_KEYS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('supplierPricingManager.occupancyHint')}</p>
                </div>
                {isHotel && (
                  <div className="space-y-2">
                    <Label>{t('supplierPricingManager.mealTreatmentLabel')}</Label>
                    <Select value={form.meal_treatment} onValueChange={(v) => setForm({ ...form, meal_treatment: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('supplierPricingManager.selectMealPlanPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {MEAL_TREATMENT_OPTION_KEYS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {t(opt.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t('supplierPricingManager.mealTreatmentHint')}</p>
                  </div>
                )}
              </div>
            </div>

            {isCarRental && (
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">
                  {t('supplierPricingManager.carRentalOptionsTitle')}
                </h4>
                <p className="text-xs text-muted-foreground mb-3">{t('supplierPricingManager.carRentalOptionsHint')}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('supplierPricingManager.carCategoryLabel')}</Label>
                    <Select
                      value={form.car_category || ''}
                      onValueChange={(v) => setForm({ ...form, car_category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('supplierPricingManager.selectCarCategoryPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {CAR_CATEGORY_OPTION_KEYS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {t(opt.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('supplierPricingManager.dailyRateLabel')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.daily_rate || ''}
                      onChange={(e) => setForm({ ...form, daily_rate: e.target.value })}
                      placeholder={t('supplierPricingManager.dailyRatePlaceholder')}
                    />
                    <p className="text-xs text-muted-foreground">{t('supplierPricingManager.dailyRateHint')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div className="space-y-2">
                    <Label>{t('supplierPricingManager.dropOffSurchargeLabel')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.drop_off_surcharge || ''}
                      onChange={(e) => setForm({ ...form, drop_off_surcharge: e.target.value })}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">{t('supplierPricingManager.dropOffSurchargeHint')}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('supplierPricingManager.insuranceSurchargeLabel')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.insurance_surcharge || ''}
                      onChange={(e) => setForm({ ...form, insurance_surcharge: e.target.value })}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('supplierPricingManager.insuranceSurchargeHint')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isGuidedTour && (
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">
                  {t('supplierPricingManager.guidedTourOptionsTitle')}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('supplierPricingManager.durationLabel')}</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={form.duration_value || ''}
                        onChange={(e) => setForm({ ...form, duration_value: e.target.value })}
                        placeholder="0"
                      />
                      <Select
                        value={form.duration_unit || 'hours'}
                        onValueChange={(v) => setForm({ ...form, duration_unit: v })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATION_UNIT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {t(opt.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('supplierPricingManager.maxCapacityLabel')}</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.max_capacity || ''}
                      onChange={(e) => setForm({ ...form, max_capacity: e.target.value })}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">{t('supplierPricingManager.maxCapacityHint')}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('supplierPricingManager.descriptionLabel')}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('common.notes')}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>

            {duplicateCheckError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-300 whitespace-pre-wrap">
                {duplicateCheckError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeModal}>
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingPricing ? t('categories.update') : t('categories.create')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
