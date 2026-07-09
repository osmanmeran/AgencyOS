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

const UNIT_LABELS = {
  per_person: 'Per Person',
  per_night: 'Per Night',
  per_trip: 'Per Trip',
  per_hour: 'Per Hour',
  per_day: 'Per Day',
  per_group: 'Per Group',
  flat_rate: 'Flat Rate',
};

const SEASON_LABELS = {
  all_year: 'All Year',
  high_season: 'High Season',
  low_season: 'Low Season',
  peak: 'Peak',
  custom: 'Custom Dates',
};

const OCCUPANCY_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'twin', label: 'Twin' },
  { value: 'triple', label: 'Triple' },
  { value: 'quad', label: 'Quad' },
  { value: 'family', label: 'Family' },
  { value: 'extra_bed', label: 'Extra Bed' },
];

const CAR_CATEGORY_OPTIONS = [
  { value: 'economy', label: 'Economy' },
  { value: 'compact', label: 'Compact' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'standard', label: 'Standard' },
  { value: 'full_size', label: 'Full Size' },
  { value: 'premium', label: 'Premium' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'suv', label: 'SUV' },
  { value: 'minivan', label: 'Minivan' },
  { value: 'convertible', label: 'Convertible' },
];

const MEAL_TREATMENT_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'RO', label: 'Room Only' },
  { value: 'BB', label: 'Bed & Breakfast' },
  { value: 'HB', label: 'Half Board' },
  { value: 'FB', label: 'Full Board' },
  { value: 'AI', label: 'All Inclusive' },
  { value: 'UAI', label: 'Ultra All Inclusive' },
];

const APPROVAL_BADGES = {
  pending: { label: 'Pending', class: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300' },
  approved: { label: 'Approved', class: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300' },
  rejected: { label: 'Rejected', class: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300' },
};

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
  notes: '',
};

export default function SupplierPricingManager({ supplierId, categoryName = '' }) {
  const catName = (categoryName || '').toLowerCase();
  const isHotel =
    catName.includes('hotel') ||
    catName.includes('lodging') ||
    catName.includes('accommodation') ||
    catName.includes('resort');
  const isTransfer = catName.includes('transfer');
  const isCarRental =
    catName.includes('rent a car') || catName.includes('car rental') || catName.includes('rental car');
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
        is_active: true,
        approval_status: 'pending',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] });
      closeModal();
      showSuccess('Pricing tier created');
    },
    onError: (error) => showError('Failed to create pricing', error.message),
  });

  const updateMutation = useMutation({
    mutationFn: (/** @type {any} */ { id, data }) =>
      db.entities.SupplierPricing.update(id, {
        ...data,
        base_price: parseFloat(data.base_price) || 0,
        client_price: data.client_price ? parseFloat(data.client_price) : null,
        min_quantity: parseInt(data.min_quantity) || 1,
        max_quantity: data.max_quantity ? parseInt(data.max_quantity) : null,
        approval_status: 'pending',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] });
      closeModal();
      showSuccess('Pricing tier updated');
    },
    onError: (error) => showError('Failed to update pricing', error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (/** @type {any} */ id) => db.entities.SupplierPricing.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] });
      showSuccess('Pricing tier deleted');
    },
    onError: (error) => showError('Failed to delete pricing', error.message),
  });

  const approveMutation = useMutation({
    mutationFn: (/** @type {any} */ { id }) => db.entities.SupplierPricing.update(id, { approval_status: 'approved' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] });
      showSuccess('Pricing tier approved');
    },
    onError: (error) => showError('Failed to approve', error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (/** @type {any} */ { id }) => db.entities.SupplierPricing.update(id, { approval_status: 'rejected' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] });
      showSuccess('Pricing tier rejected');
    },
    onError: (error) => showError('Failed to reject', error.message),
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
      setDuplicateCheckError(
        `A pricing tier "${sameName.name}" already exists with the same occupancy, meal treatment, and season. Please change the name, occupancy, meal treatment, or season dates before saving.`,
      );
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
    const config = APPROVAL_BADGES[status] || APPROVAL_BADGES.pending;
    return <Badge className={config.class}>{config.label}</Badge>;
  };

  return (
    <div>
      <Card className="p-6 bg-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">Pricing Management</h3>
          <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Add Pricing Tier
          </Button>
        </div>

        {pricings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No pricing tiers yet. Add your first one.</p>
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
                        <span className="font-normal text-muted-foreground">base</span>
                      </span>
                      {pricing.client_price != null && (
                        <span className="font-semibold text-blue-700 dark:text-blue-300">
                          ${pricing.client_price?.toFixed(2)}{' '}
                          <span className="font-normal text-muted-foreground">sell</span>
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {SEASON_LABELS[pricing.season_type] || pricing.season_type}
                      </Badge>
                      {pricing.season_start && pricing.season_end && (
                        <span className="text-xs text-muted-foreground">
                          {pricing.season_start} → {pricing.season_end}
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {UNIT_LABELS[pricing.unit] || pricing.unit}
                      </Badge>
                      {pricing.occupancy && (
                        <Badge variant="secondary" className="text-xs">
                          {OCCUPANCY_OPTIONS.find((o) => o.value === pricing.occupancy)?.label || pricing.occupancy}
                        </Badge>
                      )}
                      {pricing.meal_treatment && (
                        <Badge variant="secondary" className="text-xs">
                          {MEAL_TREATMENT_OPTIONS.find((o) => o.value === pricing.meal_treatment)?.label ||
                            pricing.meal_treatment}
                        </Badge>
                      )}
                    </div>
                    {pricing.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{pricing.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-4 flex-shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openDuplicateModal(pricing)} title="Duplicate">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditModal(pricing)} title="Edit">
                      <Edit className="w-4 h-4" />
                    </Button>
                    {pricing.approval_status === 'pending' && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => approveMutation.mutate({ id: pricing.id })}
                          title="Approve"
                        >
                          <Check className="w-4 h-4 text-green-600 dark:text-green-300" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => rejectMutation.mutate({ id: pricing.id })}
                          title="Reject"
                        >
                          <XCircle className="w-4 h-4 text-red-600 dark:text-red-300" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(pricing.id)}
                      title="Delete"
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
            <DialogTitle>{editingPricing ? 'Edit Pricing Tier' : 'Add Pricing Tier'}</DialogTitle>
            {!editingPricing && (
              <DialogDescription>
                To avoid duplicates, you must change the name, occupancy, meal treatment, or season dates from any
                existing tier before saving.
              </DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g. Premium Room"
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
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
                <Label>Base Price (cost) *</Label>
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
                <Label>Client Sell Price (optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.client_price}
                  onChange={(e) => setForm({ ...form, client_price: e.target.value })}
                  placeholder="Overrides markup calculation"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Season</Label>
                <Select value={seasonType} onValueChange={(v) => setForm({ ...form, season_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEASON_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {seasonType === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Season Start</Label>
                  <Input
                    type="date"
                    value={form.season_start}
                    onChange={(e) => setForm({ ...form, season_start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Season End</Label>
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
                <Label>Min Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.min_quantity}
                  onChange={(e) => setForm({ ...form, min_quantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.max_quantity}
                  onChange={(e) => setForm({ ...form, max_quantity: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">Hotel Pricing Options</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Occupancy</Label>
                  <Select value={form.occupancy} onValueChange={(v) => setForm({ ...form, occupancy: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select occupancy" />
                    </SelectTrigger>
                    <SelectContent>
                      {OCCUPANCY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Define different pricing tiers per occupancy type (Single, Double, Triple, etc.)
                  </p>
                </div>
                {isHotel && (
                  <div className="space-y-2">
                    <Label>Meal Treatment</Label>
                    <Select value={form.meal_treatment} onValueChange={(v) => setForm({ ...form, meal_treatment: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select meal plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {MEAL_TREATMENT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Different pricing by meal plan (BB, HB, FB, AI, etc.)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {isCarRental && (
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">Car Rental Options</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Set car category, daily rate, drop-off surcharge, and insurance supplement.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Car Category</Label>
                    <Select
                      value={form.car_category || ''}
                      onValueChange={(v) => setForm({ ...form, car_category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select car category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CAR_CATEGORY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Daily Rate</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.daily_rate || ''}
                      onChange={(e) => setForm({ ...form, daily_rate: e.target.value })}
                      placeholder="Override base_price as daily rate"
                    />
                    <p className="text-xs text-muted-foreground">
                      If set, this is used as the daily rental price instead of base_price.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div className="space-y-2">
                    <Label>Drop-off Surcharge</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.drop_off_surcharge || ''}
                      onChange={(e) => setForm({ ...form, drop_off_surcharge: e.target.value })}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Applied one-time when drop-off differs from pick-up location.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Insurance Surcharge (daily)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.insurance_surcharge || ''}
                      onChange={(e) => setForm({ ...form, insurance_surcharge: e.target.value })}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">Additional daily insurance cost.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>

            {duplicateCheckError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-300 whitespace-pre-wrap">
                {duplicateCheckError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingPricing ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
