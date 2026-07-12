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
import { DollarSign, Plus, Edit, Trash2, Copy, Check, XCircle, Loader2, MousePointerClick } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';
import { AIRPORT_LOCATIONS } from '@/lib/airportLocations';

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

const TICKET_TYPE_OPTION_KEYS = [
  { value: 'adult', labelKey: 'supplierPricingManager.ticketAdult' },
  { value: 'child', labelKey: 'supplierPricingManager.ticketChild' },
  { value: 'student', labelKey: 'supplierPricingManager.ticketStudent' },
  { value: 'senior', labelKey: 'supplierPricingManager.ticketSenior' },
  { value: 'group', labelKey: 'supplierPricingManager.ticketGroup' },
];

// Maps a category name onto the pricing wizard shown in the add/edit modal.
// Checked in order — the broad 'tour' match goes last so e.g. "Tourist
// Transfers" still resolves to the transfer wizard.
const WIZARD_KEYWORDS = [
  { type: 'hotel', keywords: ['hotel', 'lodging', 'accommodation', 'resort'] },
  { type: 'car_rental', keywords: ['rent a car', 'car rental', 'rental car'] },
  { type: 'transfer', keywords: ['transfer', 'shuttle'] },
  { type: 'museum', keywords: ['museum', 'entrance', 'ticket', 'sightseeing'] },
  { type: 'tour', keywords: ['tour', 'excursion', 'guided', 'activity'] },
];

function wizardTypeFor(categoryName) {
  const name = (categoryName || '').toLowerCase();
  for (const w of WIZARD_KEYWORDS) {
    if (w.keywords.some((k) => name.includes(k))) return w.type;
  }
  return 'generic';
}

// Sensible default pricing unit per wizard, applied when creating a new price.
const WIZARD_DEFAULT_UNIT = {
  hotel: 'per_night',
  car_rental: 'per_day',
  transfer: 'per_trip',
  museum: 'per_person',
  tour: 'per_person',
  generic: 'per_person',
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
  child_price: '',
  child_client_price: '',
  car_category: '',
  drop_off_surcharge: '',
  insurance_surcharge: '',
  duration_value: '',
  duration_unit: 'hours',
  max_capacity: '',
  pax_tiers: /** @type {any[]} */ ([]),
  route_from: '',
  route_to: '',
  max_passengers: '',
  ticket_type: '',
  service_id: '',
  notes: '',
};

/** One editable per-pax price band row for the guided-tour wizard. */
const emptyPaxTier = () => ({
  _key: `paxtier-${Date.now()}-${Math.random()}`,
  min_pax: '',
  max_pax: '',
  price_per_person: '',
  client_price_per_person: '',
});

/** Parses the editable band rows back into stored pax_tiers (drops blanks). */
const cleanPaxTiers = (tiers) =>
  (tiers || [])
    .filter((t) => t.min_pax !== '' && t.price_per_person !== '')
    .map((t) => ({
      min_pax: parseInt(t.min_pax),
      max_pax: t.max_pax !== '' && t.max_pax != null ? parseInt(t.max_pax) : null,
      price_per_person: parseFloat(t.price_per_person) || 0,
      client_price_per_person:
        t.client_price_per_person !== '' && t.client_price_per_person != null
          ? parseFloat(t.client_price_per_person)
          : null,
    }));

/** Compact label for a band: "2", "2–4" or "5+". */
const paxTierRangeLabel = (t) => {
  const min = t.min_pax ?? '?';
  if (t.max_pax == null || t.max_pax === '') return `${min}+`;
  return Number(t.max_pax) === Number(t.min_pax) ? `${min}` : `${min}–${t.max_pax}`;
};

/** Maps a stored pricing row into the modal's form state. */
const pricingToForm = (pricing) => ({
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
  child_price: pricing.child_price?.toString() || '',
  child_client_price: pricing.child_client_price?.toString() || '',
  car_category: pricing.car_category || '',
  drop_off_surcharge: pricing.drop_off_surcharge?.toString() || '',
  insurance_surcharge: pricing.insurance_surcharge?.toString() || '',
  duration_value: pricing.duration_value?.toString() || '',
  duration_unit: pricing.duration_unit || 'hours',
  max_capacity: pricing.max_capacity?.toString() || '',
  pax_tiers: (pricing.pax_tiers || []).map((t, i) => ({
    _key: `paxtier-loaded-${i}`,
    min_pax: t.min_pax?.toString() ?? '',
    max_pax: t.max_pax?.toString() ?? '',
    price_per_person: t.price_per_person?.toString() ?? '',
    client_price_per_person: t.client_price_per_person?.toString() ?? '',
  })),
  route_from: pricing.route_from || '',
  route_to: pricing.route_to || '',
  max_passengers: pricing.max_passengers?.toString() || '',
  ticket_type: pricing.ticket_type || '',
  service_id: pricing.service_id || '',
  notes: pricing.notes || '',
});

const optionLabel = (t, options, value) => {
  const opt = options.find((o) => o.value === value);
  return opt ? t(opt.labelKey) : value;
};

export default function SupplierPricingManager({ supplierId, categories = /** @type {any} */ ([]) }) {
  const { t } = useT();
  const [activeCategory, setActiveCategory] = useState(/** @type {any} */ (null));
  // Category comes first: with several categories the user must pick one
  // before the list and the (category-specific) wizard appear; a single
  // category is selected automatically.
  const selectedCategory =
    categories.length === 1 ? categories[0] : categories.find((c) => c.id === activeCategory?.id) || null;
  const wizard = wizardTypeFor(selectedCategory?.name);
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

  const { data: mySubs = [] } = useQuery({
    queryKey: ['supplierSubcategories', supplierId],
    queryFn: () => db.entities.SupplierSubcategory.filter({ supplier_id: supplierId }),
    enabled: !!supplierId,
  });
  const { data: myServices = [] } = useQuery({
    queryKey: ['supplierServices', supplierId],
    queryFn: () => db.entities.SupplierService.filter({ supplier_id: supplierId }),
    enabled: !!supplierId,
  });

  // The selected category scopes everything: which prices are listed, which
  // subcategory a new price is linked to, and which services can be linked.
  const selectedSubIds = (mySubs || []).filter((s) => s.category_id === selectedCategory?.id).map((s) => s.id);
  const activeSubId = selectedSubIds[0] || '';
  const activeServices = (myServices || []).filter((s) => selectedSubIds.includes(s.subcategory_id));
  const serviceName = (id) => (myServices || []).find((s) => s.id === id)?.service_name || '';

  const categoryPricings = pricings.filter((p) => selectedSubIds.includes(p.subcategory_id));
  // Prices with no (or a dangling) category link — kept visible so legacy
  // rows never silently disappear; saving one files it under the selected
  // category.
  const knownSubIds = new Set((mySubs || []).map((s) => s.id));
  const unassignedPricings = pricings.filter((p) => !p.subcategory_id || !knownSubIds.has(p.subcategory_id));

  const createMutation = useMutation({
    mutationFn: (/** @type {any} */ data) =>
      db.entities.SupplierPricing.create({
        ...data,
        supplier_id: supplierId,
        subcategory_id: activeSubId || null,
        base_price: parseFloat(data.base_price) || 0,
        client_price: data.client_price ? parseFloat(data.client_price) : null,
        child_price: data.child_price ? parseFloat(data.child_price) : null,
        child_client_price: data.child_client_price ? parseFloat(data.child_client_price) : null,
        min_quantity: parseInt(data.min_quantity) || 1,
        max_quantity: data.max_quantity ? parseInt(data.max_quantity) : null,
        duration_value: data.duration_value ? parseFloat(data.duration_value) : null,
        max_capacity: data.max_capacity ? parseInt(data.max_capacity) : null,
        max_passengers: data.max_passengers ? parseInt(data.max_passengers) : null,
        pax_tiers: cleanPaxTiers(data.pax_tiers),
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
        // Keep the pricing's existing category link; an unassigned price
        // adopts the currently selected category when saved.
        subcategory_id: /** @type {any} */ (editingPricing)?.subcategory_id || activeSubId || null,
        base_price: parseFloat(data.base_price) || 0,
        client_price: data.client_price ? parseFloat(data.client_price) : null,
        child_price: data.child_price ? parseFloat(data.child_price) : null,
        child_client_price: data.child_client_price ? parseFloat(data.child_client_price) : null,
        min_quantity: parseInt(data.min_quantity) || 1,
        max_quantity: data.max_quantity ? parseInt(data.max_quantity) : null,
        duration_value: data.duration_value ? parseFloat(data.duration_value) : null,
        max_capacity: data.max_capacity ? parseInt(data.max_capacity) : null,
        max_passengers: data.max_passengers ? parseInt(data.max_passengers) : null,
        pax_tiers: cleanPaxTiers(data.pax_tiers),
        // Staff are the approvers here (unlike the supplier self-service
        // portal), so their own edits shouldn't unpublish an already-approved
        // price. Keep whatever approval_status it already had.
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
    // Scoped to the selected category (+ unassigned) — the same tier name may
    // legitimately exist under a different category.
    const sameName = [...categoryPricings, ...unassignedPricings].find(
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
    setForm({ ...EMPTY_FORM, unit: WIZARD_DEFAULT_UNIT[wizard] || 'per_person' });
    setDuplicateCheckError('');
    setModalOpen(true);
  };

  const openEditModal = (pricing) => {
    setEditingPricing(pricing);
    setForm(pricingToForm(pricing));
    setDuplicateCheckError('');
    setModalOpen(true);
  };

  const openDuplicateModal = (pricing) => {
    setEditingPricing(null);
    setForm({ ...pricingToForm(pricing), name: pricing.name ? `${pricing.name} (copy)` : '' });
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

  const addPaxTier = () => setForm((f) => ({ ...f, pax_tiers: [...(f.pax_tiers || []), emptyPaxTier()] }));
  const updatePaxTier = (key, field, value) =>
    setForm((f) => ({
      ...f,
      pax_tiers: (f.pax_tiers || []).map((t) => (t._key === key ? { ...t, [field]: value } : t)),
    }));
  const removePaxTier = (key) =>
    setForm((f) => ({ ...f, pax_tiers: (f.pax_tiers || []).filter((t) => t._key !== key) }));

  const seasonType = form.season_type || 'all_year';

  const getApprovalBadge = (status) => {
    const config = APPROVAL_BADGE_CONFIG[status] || APPROVAL_BADGE_CONFIG.pending;
    return <Badge className={config.class}>{t(config.labelKey)}</Badge>;
  };

  const renderPricingRow = (pricing) => (
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
              <span className="font-normal text-muted-foreground">{t('supplierPricingManager.baseSuffix')}</span>
            </span>
            {pricing.client_price != null && (
              <span className="font-semibold text-blue-700 dark:text-blue-300">
                ${pricing.client_price?.toFixed(2)}{' '}
                <span className="font-normal text-muted-foreground">{t('supplierPricingManager.sellSuffix')}</span>
              </span>
            )}
            <Badge variant="outline" className="text-xs">
              {SEASON_LABEL_KEYS[pricing.season_type] ? t(SEASON_LABEL_KEYS[pricing.season_type]) : pricing.season_type}
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
                {optionLabel(t, OCCUPANCY_OPTION_KEYS, pricing.occupancy)}
              </Badge>
            )}
            {pricing.meal_treatment && (
              <Badge variant="secondary" className="text-xs">
                {optionLabel(t, MEAL_TREATMENT_OPTION_KEYS, pricing.meal_treatment)}
              </Badge>
            )}
            {pricing.child_price != null && (
              <Badge variant="secondary" className="text-xs">
                {t('supplierPricingManager.childSupplementBadge', {
                  price: (pricing.child_client_price ?? pricing.child_price).toFixed(2),
                })}
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
            {(pricing.pax_tiers || []).map((tier, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {t('supplierPricingManager.paxTierBadge', {
                  range: paxTierRangeLabel(tier),
                  price: tier.price_per_person,
                })}
              </Badge>
            ))}
            {(pricing.route_from || pricing.route_to) && (
              <Badge variant="secondary" className="text-xs">
                {pricing.route_from || '?'} → {pricing.route_to || '?'}
              </Badge>
            )}
            {pricing.max_passengers != null && (
              <Badge variant="secondary" className="text-xs">
                {t('supplierPricingManager.maxCapacityBadge', { count: pricing.max_passengers })}
              </Badge>
            )}
            {pricing.ticket_type && (
              <Badge variant="secondary" className="text-xs">
                {optionLabel(t, TICKET_TYPE_OPTION_KEYS, pricing.ticket_type)}
              </Badge>
            )}
            {pricing.service_id && (
              <Badge variant="outline" className="text-xs">
                {t('supplierPricingManager.linkedServiceBadge', { name: serviceName(pricing.service_id) })}
              </Badge>
            )}
            {(pricing.min_quantity > 1 || pricing.max_quantity != null) && (
              <Badge variant="outline" className="text-xs">
                {t('supplierPricingManager.quantityBadge', {
                  min: pricing.min_quantity || 1,
                  max: pricing.max_quantity != null ? pricing.max_quantity : '+',
                })}
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
  );

  return (
    <div>
      <Card className="p-6 bg-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">{t('supplierPricingManager.pricingManagementTitle')}</h3>
          <Button onClick={openCreateModal} disabled={!selectedCategory}>
            <Plus className="w-4 h-4 mr-2" /> {t('supplierPricingManager.addPricingTier')}
          </Button>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('supplierPricingManager.noCategoriesAssigned')}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map((cat) => {
                const active = cat.id === selectedCategory?.id;
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

            {!selectedCategory ? (
              <div className="text-center py-12 text-muted-foreground">
                <MousePointerClick className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('supplierPricingManager.selectCategoryFirst')}</p>
              </div>
            ) : categoryPricings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('supplierPricingManager.noPricesInCategory', { name: selectedCategory.name })}</p>
              </div>
            ) : (
              <div className="space-y-3">{categoryPricings.map(renderPricingRow)}</div>
            )}

            {unassignedPricings.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border">
                <h4 className="text-sm font-semibold text-foreground">
                  {t('supplierPricingManager.unassignedTitle', { count: unassignedPricings.length })}
                </h4>
                <p className="text-xs text-muted-foreground mb-3">{t('supplierPricingManager.unassignedHint')}</p>
                <div className="space-y-3">{unassignedPricings.map(renderPricingRow)}</div>
              </div>
            )}
          </>
        )}
      </Card>

      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPricing
                ? t('supplierPricingManager.editPricingTierTitle')
                : t('supplierPricingManager.addPricingTier')}
              {selectedCategory ? ` — ${selectedCategory.name}` : ''}
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

            {activeServices.length > 0 && (
              <div className="space-y-2">
                <Label>{t('supplierPricingManager.serviceLabel')}</Label>
                <Select value={form.service_id || ''} onValueChange={(v) => setForm({ ...form, service_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('supplierPricingManager.selectServicePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeServices.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.service_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t('supplierPricingManager.serviceHint')}</p>
              </div>
            )}

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

            {wizard === 'hotel' && (
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
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>{t('supplierPricingManager.childPriceLabel')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.child_price}
                      onChange={(e) => setForm({ ...form, child_price: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('supplierPricingManager.childClientPriceLabel')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.child_client_price}
                      onChange={(e) => setForm({ ...form, child_client_price: e.target.value })}
                      placeholder={t('supplierPricingManager.childClientPricePlaceholder')}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{t('supplierPricingManager.childPriceHint')}</p>
              </div>
            )}

            {wizard === 'car_rental' && (
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">
                  {t('supplierPricingManager.carRentalOptionsTitle')}
                </h4>
                <p className="text-xs text-muted-foreground mb-3">{t('supplierPricingManager.carRentalOptionsHint')}</p>
                <div className="space-y-2">
                  <Label>{t('supplierPricingManager.carCategoryLabel')}</Label>
                  <Select value={form.car_category || ''} onValueChange={(v) => setForm({ ...form, car_category: v })}>
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
                  <p className="text-xs text-muted-foreground">{t('supplierPricingManager.carRentalPriceHint')}</p>
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

            {wizard === 'tour' && (
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

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-foreground">
                      {t('supplierPricingManager.paxTiersTitle')}
                    </h4>
                    <Button type="button" variant="outline" size="sm" onClick={addPaxTier}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> {t('supplierPricingManager.addPaxTier')}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{t('supplierPricingManager.paxTiersHint')}</p>
                  {(form.pax_tiers || []).length > 0 && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 text-xs font-semibold text-muted-foreground uppercase px-1">
                        <span>{t('supplierPricingManager.paxTierMinLabel')}</span>
                        <span>{t('supplierPricingManager.paxTierMaxLabel')}</span>
                        <span>{t('supplierPricingManager.paxTierCostLabel')}</span>
                        <span>{t('supplierPricingManager.paxTierSellLabel')}</span>
                        <span></span>
                      </div>
                      {(form.pax_tiers || []).map((tier) => (
                        <div key={tier._key} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                          <Input
                            type="number"
                            min="1"
                            value={tier.min_pax}
                            onChange={(e) => updatePaxTier(tier._key, 'min_pax', e.target.value)}
                            placeholder="2"
                          />
                          <Input
                            type="number"
                            min="1"
                            value={tier.max_pax}
                            onChange={(e) => updatePaxTier(tier._key, 'max_pax', e.target.value)}
                            placeholder="∞"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={tier.price_per_person}
                            onChange={(e) => updatePaxTier(tier._key, 'price_per_person', e.target.value)}
                            placeholder="0.00"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={tier.client_price_per_person}
                            onChange={(e) => updatePaxTier(tier._key, 'client_price_per_person', e.target.value)}
                            placeholder={t('supplierPricingManager.paxTierSellPlaceholder')}
                          />
                          <Button type="button" variant="ghost" size="icon" onClick={() => removePaxTier(tier._key)}>
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {wizard === 'transfer' && (
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">
                  {t('supplierPricingManager.transferOptionsTitle')}
                </h4>
                <p className="text-xs text-muted-foreground mb-3">{t('supplierPricingManager.transferOptionsHint')}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('supplierPricingManager.routeFromLabel')}</Label>
                    <Select value={form.route_from || ''} onValueChange={(v) => setForm({ ...form, route_from: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('supplierPricingManager.selectRouteFromPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {AIRPORT_LOCATIONS.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('supplierPricingManager.routeToLabel')}</Label>
                    <Select value={form.route_to || ''} onValueChange={(v) => setForm({ ...form, route_to: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('supplierPricingManager.selectRouteToPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {AIRPORT_LOCATIONS.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2 mt-3">
                  <Label>{t('supplierPricingManager.maxPassengersLabel')}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.max_passengers || ''}
                    onChange={(e) => setForm({ ...form, max_passengers: e.target.value })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">{t('supplierPricingManager.maxPassengersHint')}</p>
                </div>
              </div>
            )}

            {wizard === 'museum' && (
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">
                  {t('supplierPricingManager.museumOptionsTitle')}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('supplierPricingManager.ticketTypeLabel')}</Label>
                    <Select value={form.ticket_type || ''} onValueChange={(v) => setForm({ ...form, ticket_type: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('supplierPricingManager.selectTicketTypePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_TYPE_OPTION_KEYS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {t(opt.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t('supplierPricingManager.ticketTypeHint')}</p>
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
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
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
