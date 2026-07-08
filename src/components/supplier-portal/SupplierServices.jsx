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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, DollarSign, Plus, Edit, Trash2, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

const UNIT_LABEL_KEYS = {
  per_person: 'supplierPortalServices.unitPerPerson',
  per_night: 'supplierPortalServices.unitPerNight',
  per_trip: 'supplierPortalServices.unitPerTrip',
  per_hour: 'supplierPortalServices.unitPerHour',
  per_day: 'supplierPortalServices.unitPerDay',
  flat_rate: 'supplierPortalServices.unitFlatRate',
};

const SEASON_LABEL_KEYS = {
  all_year: 'supplierPortalServices.seasonAllYear',
  high_season: 'supplierPortalServices.seasonHigh',
  low_season: 'supplierPortalServices.seasonLow',
  peak: 'supplierPortalServices.seasonPeak',
  custom: 'supplierPortalServices.seasonCustom',
};

const APPROVAL_STATUS_CONFIG = {
  pending: {
    labelKey: 'supplierPortalServices.approvalPending',
    color: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300',
    icon: Clock,
  },
  approved: {
    labelKey: 'supplierPortalServices.approvalApproved',
    color: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
    icon: CheckCircle,
  },
  rejected: {
    labelKey: 'supplierPortalServices.approvalRejected',
    color: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
    icon: AlertCircle,
  },
};

export default function SupplierServices({ supplierId }) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [editingPricing, setEditingPricing] = useState(null);

  const [serviceForm, setServiceForm] = useState({
    service_name: '',
    description: '',
    budgeted_cost: '',
    currency: 'USD',
    unit: 'per_person',
    notes: '',
  });

  const [pricingForm, setPricingForm] = useState({
    name: '',
    description: '',
    base_price: '',
    currency: 'USD',
    unit: 'per_person',
    season_type: 'all_year',
    season_start: '',
    season_end: '',
    min_quantity: 1,
    max_quantity: '',
    notes: '',
  });

  const { data: services = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierServices', supplierId],
      queryFn: () => db.entities.SupplierService.filter({ supplier_id: supplierId }),
      enabled: !!supplierId,
    })
  );

  const { data: pricings = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierPricings', supplierId],
      queryFn: () => db.entities.SupplierPricing.filter({ supplier_id: supplierId }),
      enabled: !!supplierId,
    })
  );

  const { data: subcategories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierSubcategories', supplierId],
      queryFn: () => db.entities.SupplierSubcategory.filter({ supplier_id: supplierId }),
      enabled: !!supplierId,
    })
  );

  // Service mutations
  const createServiceMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) =>
        db.entities.SupplierService.create({
          ...data,
          supplier_id: supplierId,
          budgeted_cost: parseFloat(data.budgeted_cost) || 0,
          status: 'quoted',
          approval_status: 'pending',
        }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['supplierServices', supplierId] });
        closeServiceModal();
      },
    })
  );

  const updateServiceMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) =>
        db.entities.SupplierService.update(id, {
          ...data,
          budgeted_cost: parseFloat(data.budgeted_cost) || 0,
          approval_status: 'pending', // Re-submit for approval on edit
        }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['supplierServices', supplierId] });
        closeServiceModal();
      },
    })
  );

  const deleteServiceMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.SupplierService.delete(id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supplierServices', supplierId] }),
    })
  );

  // Pricing mutations
  const createPricingMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) =>
        db.entities.SupplierPricing.create({
          ...data,
          supplier_id: supplierId,
          base_price: parseFloat(data.base_price) || 0,
          min_quantity: parseInt(data.min_quantity) || 1,
          max_quantity: data.max_quantity ? parseInt(data.max_quantity) : null,
          is_active: true,
          approval_status: 'pending',
        }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] });
        closePricingModal();
      },
    })
  );

  const updatePricingMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) =>
        db.entities.SupplierPricing.update(id, {
          ...data,
          base_price: parseFloat(data.base_price) || 0,
          min_quantity: parseInt(data.min_quantity) || 1,
          max_quantity: data.max_quantity ? parseInt(data.max_quantity) : null,
          approval_status: 'pending',
        }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] });
        closePricingModal();
      },
    })
  );

  const deletePricingMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.SupplierPricing.delete(id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] }),
    })
  );

  const openServiceModal = (service = null) => {
    if (service) {
      setEditingService(service);
      setServiceForm({
        service_name: service.service_name || '',
        description: service.description || '',
        budgeted_cost: service.budgeted_cost?.toString() || '',
        currency: service.currency || 'USD',
        unit: service.unit || 'per_person',
        notes: service.notes || '',
      });
    } else {
      setEditingService(null);
      setServiceForm({
        service_name: '',
        description: '',
        budgeted_cost: '',
        currency: 'USD',
        unit: 'per_person',
        notes: '',
      });
    }
    setServiceModalOpen(true);
  };

  const closeServiceModal = () => {
    setServiceModalOpen(false);
    setEditingService(null);
  };

  const openPricingModal = (pricing = null) => {
    if (pricing) {
      setEditingPricing(pricing);
      setPricingForm({
        name: pricing.name || '',
        description: pricing.description || '',
        base_price: pricing.base_price?.toString() || '',
        currency: pricing.currency || 'USD',
        unit: pricing.unit || 'per_person',
        season_type: pricing.season_type || 'all_year',
        season_start: pricing.season_start || '',
        season_end: pricing.season_end || '',
        min_quantity: pricing.min_quantity || 1,
        max_quantity: pricing.max_quantity?.toString() || '',
        notes: pricing.notes || '',
      });
    } else {
      setEditingPricing(null);
      setPricingForm({
        name: '',
        description: '',
        base_price: '',
        currency: 'USD',
        unit: 'per_person',
        season_type: 'all_year',
        season_start: '',
        season_end: '',
        min_quantity: 1,
        max_quantity: '',
        notes: '',
      });
    }
    setPricingModalOpen(true);
  };

  const closePricingModal = () => {
    setPricingModalOpen(false);
    setEditingPricing(null);
  };

  const handleServiceSubmit = (e) => {
    e.preventDefault();
    if (editingService) {
      updateServiceMutation.mutate({ id: editingService.id, data: serviceForm });
    } else {
      createServiceMutation.mutate(serviceForm);
    }
  };

  const handlePricingSubmit = (e) => {
    e.preventDefault();
    if (editingPricing) {
      updatePricingMutation.mutate({ id: editingPricing.id, data: pricingForm });
    } else {
      createPricingMutation.mutate(pricingForm);
    }
  };

  const getApprovalBadge = (status) => {
    const config = APPROVAL_STATUS_CONFIG[status] || APPROVAL_STATUS_CONFIG.pending;
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {t(config.labelKey)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={() => openServiceModal()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> {t('supplierPortalServices.addService')}
        </Button>
        <Button onClick={() => openPricingModal()} variant="outline">
          <Plus className="w-4 h-4 mr-2" /> {t('supplierPortalServices.addPricingTier')}
        </Button>
      </div>

      {/* Subcategories */}
      {subcategories.length > 0 && (
        <Card className="p-6 bg-card">
          <h3 className="text-lg font-bold text-foreground mb-4">{t('supplierPortalServices.serviceCategories')}</h3>
          <div className="flex flex-wrap gap-2">
            {subcategories.map((sub) => (
              <Badge key={sub.id} variant="outline" className="px-3 py-1">
                {sub.name}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Services */}
      <Card className="p-6 bg-card">
        <h3 className="text-lg font-bold text-foreground mb-4">{t('supplierPortalServices.yourServices')}</h3>
        {services.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>{t('supplierPortalServices.noServicesBody')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {services.map((service) => (
              <div key={service.id} className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-foreground">{service.service_name}</h4>
                      {getApprovalBadge(service.approval_status)}
                    </div>
                    {service.description && <p className="text-sm text-muted-foreground mt-1">{service.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>{UNIT_LABEL_KEYS[service.unit] ? t(UNIT_LABEL_KEYS[service.unit]) : service.unit}</span>
                      {service.budgeted_cost > 0 && (
                        <span className="text-green-700 dark:text-green-300 font-semibold">
                          ${service.budgeted_cost.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openServiceModal(service)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteServiceMutation.mutate(service.id)}>
                      <Trash2 className="w-4 h-4 text-red-500 dark:text-red-300" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pricing Tiers */}
      <Card className="p-6 bg-card">
        <h3 className="text-lg font-bold text-foreground mb-4">{t('supplierPortalServices.pricingTiers')}</h3>
        {pricings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>{t('supplierPortalServices.noPricingBody')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pricings.map((pricing) => (
              <div key={pricing.id} className="p-4 border border-border rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-foreground">{pricing.name}</h4>
                    {getApprovalBadge(pricing.approval_status)}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openPricingModal(pricing)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deletePricingMutation.mutate(pricing.id)}>
                      <Trash2 className="w-4 h-4 text-red-500 dark:text-red-300" />
                    </Button>
                  </div>
                </div>
                <Badge
                  className={
                    pricing.season_type === 'high_season'
                      ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                      : pricing.season_type === 'low_season'
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
                        : 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300'
                  }
                >
                  {pricing.season_type && SEASON_LABEL_KEYS[pricing.season_type]
                    ? t(SEASON_LABEL_KEYS[pricing.season_type])
                    : t('supplierPortalServices.seasonAllYear')}
                </Badge>
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-green-700 dark:text-green-300">
                    ${pricing.base_price?.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">
                    ({UNIT_LABEL_KEYS[pricing.unit] ? t(UNIT_LABEL_KEYS[pricing.unit]) : pricing.unit})
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Service Modal */}
      <Dialog open={serviceModalOpen} onOpenChange={closeServiceModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService
                ? t('supplierPortalServices.editServiceTitle')
                : t('supplierPortalServices.addNewServiceTitle')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleServiceSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t('supplierPortalServices.serviceNameLabel')}</Label>
              <Input
                value={serviceForm.service_name}
                onChange={(e) => setServiceForm({ ...serviceForm, service_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t('supplierPortalServices.descriptionLabel')}</Label>
              <Textarea
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('supplierPortalServices.priceLabel')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={serviceForm.budgeted_cost}
                  onChange={(e) => setServiceForm({ ...serviceForm, budgeted_cost: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('supplierPortalServices.unitLabel')}</Label>
                <Select value={serviceForm.unit} onValueChange={(v) => setServiceForm({ ...serviceForm, unit: v })}>
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
            </div>
            <div className="space-y-2">
              <Label>{t('common.notes')}</Label>
              <Textarea
                value={serviceForm.notes}
                onChange={(e) => setServiceForm({ ...serviceForm, notes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/40 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
              {t('supplierPortalServices.approvalNoticeService')}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeServiceModal}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingService
                  ? t('supplierPortalServices.updateButton')
                  : t('supplierPortalServices.submitForApproval')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pricing Modal */}
      <Dialog open={pricingModalOpen} onOpenChange={closePricingModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPricing
                ? t('supplierPortalServices.editPricingTierTitle')
                : t('supplierPortalServices.addPricingTier')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePricingSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('supplierPortalServices.tierNameLabel')}</Label>
                <Input
                  value={pricingForm.name}
                  onChange={(e) => setPricingForm({ ...pricingForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t('supplierPortalServices.basePriceLabel')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={pricingForm.base_price}
                  onChange={(e) => setPricingForm({ ...pricingForm, base_price: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('supplierPortalServices.unitLabel')}</Label>
                <Select value={pricingForm.unit} onValueChange={(v) => setPricingForm({ ...pricingForm, unit: v })}>
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
                <Label>{t('supplierPortalServices.seasonLabel')}</Label>
                <Select
                  value={pricingForm.season_type}
                  onValueChange={(v) => setPricingForm({ ...pricingForm, season_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_year">{t('supplierPortalServices.seasonAllYear')}</SelectItem>
                    <SelectItem value="high_season">{t('supplierPortalServices.seasonHigh')}</SelectItem>
                    <SelectItem value="low_season">{t('supplierPortalServices.seasonLow')}</SelectItem>
                    <SelectItem value="peak">{t('supplierPortalServices.seasonPeak')}</SelectItem>
                    <SelectItem value="custom">{t('supplierPortalServices.seasonCustom')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {pricingForm.season_type === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('supplierPortalServices.seasonStartLabel')}</Label>
                  <Input
                    type="date"
                    value={pricingForm.season_start}
                    onChange={(e) => setPricingForm({ ...pricingForm, season_start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('supplierPortalServices.seasonEndLabel')}</Label>
                  <Input
                    type="date"
                    value={pricingForm.season_end}
                    onChange={(e) => setPricingForm({ ...pricingForm, season_end: e.target.value })}
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('supplierPortalServices.minQuantityLabel')}</Label>
                <Input
                  type="number"
                  value={pricingForm.min_quantity}
                  onChange={(e) => setPricingForm({ ...pricingForm, min_quantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('supplierPortalServices.maxQuantityLabel')}</Label>
                <Input
                  type="number"
                  value={pricingForm.max_quantity}
                  onChange={(e) => setPricingForm({ ...pricingForm, max_quantity: e.target.value })}
                  placeholder={t('supplierPortalServices.noLimitPlaceholder')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('supplierPortalServices.descriptionLabel')}</Label>
              <Textarea
                value={pricingForm.description}
                onChange={(e) => setPricingForm({ ...pricingForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/40 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
              {t('supplierPortalServices.approvalNoticePricing')}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closePricingModal}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingPricing
                  ? t('supplierPortalServices.updateButton')
                  : t('supplierPortalServices.submitForApproval')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
