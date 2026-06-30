const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

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

const UNIT_LABELS = {
  per_person: 'Per Person',
  per_night: 'Per Night',
  per_trip: 'Per Trip',
  per_hour: 'Per Hour',
  per_day: 'Per Day',
  flat_rate: 'Flat Rate'
};

const APPROVAL_STATUS = {
  pending: { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: AlertCircle }
};

export default function SupplierServices({ supplierId }) {
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
    notes: ''
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
    notes: ''
  });

  const { data: services = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['supplierServices', supplierId],
    queryFn: () => db.entities.SupplierService.filter({ supplier_id: supplierId }),
    enabled: !!supplierId
  }));

  const { data: pricings = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['supplierPricings', supplierId],
    queryFn: () => db.entities.SupplierPricing.filter({ supplier_id: supplierId }),
    enabled: !!supplierId
  }));

  const { data: subcategories = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['supplierSubcategories', supplierId],
    queryFn: () => db.entities.SupplierSubcategory.filter({ supplier_id: supplierId }),
    enabled: !!supplierId
  }));

  // Service mutations
  const createServiceMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ data) => db.entities.SupplierService.create({
      ...data,
      supplier_id: supplierId,
      budgeted_cost: parseFloat(data.budgeted_cost) || 0,
      status: 'quoted',
      approval_status: 'pending'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierServices', supplierId] });
      closeServiceModal();
    }
  }));

  const updateServiceMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) => db.entities.SupplierService.update(id, {
      ...data,
      budgeted_cost: parseFloat(data.budgeted_cost) || 0,
      approval_status: 'pending' // Re-submit for approval on edit
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierServices', supplierId] });
      closeServiceModal();
    }
  }));

  const deleteServiceMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ id) => db.entities.SupplierService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supplierServices', supplierId] })
  }));

  // Pricing mutations
  const createPricingMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ data) => db.entities.SupplierPricing.create({
      ...data,
      supplier_id: supplierId,
      base_price: parseFloat(data.base_price) || 0,
      min_quantity: parseInt(data.min_quantity) || 1,
      max_quantity: data.max_quantity ? parseInt(data.max_quantity) : null,
      is_active: true,
      approval_status: 'pending'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] });
      closePricingModal();
    }
  }));

  const updatePricingMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) => db.entities.SupplierPricing.update(id, {
      ...data,
      base_price: parseFloat(data.base_price) || 0,
      min_quantity: parseInt(data.min_quantity) || 1,
      max_quantity: data.max_quantity ? parseInt(data.max_quantity) : null,
      approval_status: 'pending'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] });
      closePricingModal();
    }
  }));

  const deletePricingMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ id) => db.entities.SupplierPricing.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supplierPricings', supplierId] })
  }));

  const openServiceModal = (service = null) => {
    if (service) {
      setEditingService(service);
      setServiceForm({
        service_name: service.service_name || '',
        description: service.description || '',
        budgeted_cost: service.budgeted_cost?.toString() || '',
        currency: service.currency || 'USD',
        unit: service.unit || 'per_person',
        notes: service.notes || ''
      });
    } else {
      setEditingService(null);
      setServiceForm({ service_name: '', description: '', budgeted_cost: '', currency: 'USD', unit: 'per_person', notes: '' });
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
        notes: pricing.notes || ''
      });
    } else {
      setEditingPricing(null);
      setPricingForm({ name: '', description: '', base_price: '', currency: 'USD', unit: 'per_person', season_type: 'all_year', season_start: '', season_end: '', min_quantity: 1, max_quantity: '', notes: '' });
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
    const config = APPROVAL_STATUS[status] || APPROVAL_STATUS.pending;
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={() => openServiceModal()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Add Service
        </Button>
        <Button onClick={() => openPricingModal()} variant="outline">
          <Plus className="w-4 h-4 mr-2" /> Add Pricing Tier
        </Button>
      </div>

      {/* Subcategories */}
      {subcategories.length > 0 && (
        <Card className="p-6 bg-white">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Service Categories</h3>
          <div className="flex flex-wrap gap-2">
            {subcategories.map(sub => (
              <Badge key={sub.id} variant="outline" className="px-3 py-1">{sub.name}</Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Services */}
      <Card className="p-6 bg-white">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Your Services</h3>
        {services.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No services yet. Add your first service above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {services.map(service => (
              <div key={service.id} className="p-4 bg-slate-50 rounded-lg">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-900">{service.service_name}</h4>
                      {getApprovalBadge(service.approval_status)}
                    </div>
                    {service.description && (
                      <p className="text-sm text-slate-600 mt-1">{service.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                      <span>{UNIT_LABELS[service.unit] || service.unit}</span>
                      {service.budgeted_cost > 0 && (
                        <span className="text-green-700 font-semibold">${service.budgeted_cost.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openServiceModal(service)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteServiceMutation.mutate(service.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pricing Tiers */}
      <Card className="p-6 bg-white">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Pricing Tiers</h3>
        {pricings.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No pricing tiers yet. Add your first pricing tier above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pricings.map(pricing => (
              <div key={pricing.id} className="p-4 border border-slate-200 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-slate-900">{pricing.name}</h4>
                    {getApprovalBadge(pricing.approval_status)}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openPricingModal(pricing)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deletePricingMutation.mutate(pricing.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
                <Badge className={
                  pricing.season_type === 'high_season' ? 'bg-red-100 text-red-800' :
                  pricing.season_type === 'low_season' ? 'bg-green-100 text-green-800' :
                  'bg-blue-100 text-blue-800'
                }>
                  {pricing.season_type?.replace('_', ' ') || 'All Year'}
                </Badge>
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-green-700">${pricing.base_price?.toFixed(2)}</span>
                  <span className="text-slate-500">({UNIT_LABELS[pricing.unit] || pricing.unit})</span>
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
            <DialogTitle>{editingService ? 'Edit Service' : 'Add New Service'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleServiceSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Service Name *</Label>
              <Input value={serviceForm.service_name} onChange={(e) => setServiceForm({ ...serviceForm, service_name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price</Label>
                <Input type="number" step="0.01" value={serviceForm.budgeted_cost} onChange={(e) => setServiceForm({ ...serviceForm, budgeted_cost: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={serviceForm.unit} onValueChange={(v) => setServiceForm({ ...serviceForm, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={serviceForm.notes} onChange={(e) => setServiceForm({ ...serviceForm, notes: e.target.value })} rows={2} />
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
              New services require admin approval before becoming visible.
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeServiceModal}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingService ? 'Update' : 'Submit for Approval'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pricing Modal */}
      <Dialog open={pricingModalOpen} onOpenChange={closePricingModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPricing ? 'Edit Pricing Tier' : 'Add Pricing Tier'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePricingSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tier Name *</Label>
                <Input value={pricingForm.name} onChange={(e) => setPricingForm({ ...pricingForm, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Base Price *</Label>
                <Input type="number" step="0.01" value={pricingForm.base_price} onChange={(e) => setPricingForm({ ...pricingForm, base_price: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={pricingForm.unit} onValueChange={(v) => setPricingForm({ ...pricingForm, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Season</Label>
                <Select value={pricingForm.season_type} onValueChange={(v) => setPricingForm({ ...pricingForm, season_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_year">All Year</SelectItem>
                    <SelectItem value="high_season">High Season</SelectItem>
                    <SelectItem value="low_season">Low Season</SelectItem>
                    <SelectItem value="peak">Peak</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {pricingForm.season_type === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Season Start</Label>
                  <Input type="date" value={pricingForm.season_start} onChange={(e) => setPricingForm({ ...pricingForm, season_start: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Season End</Label>
                  <Input type="date" value={pricingForm.season_end} onChange={(e) => setPricingForm({ ...pricingForm, season_end: e.target.value })} />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Quantity</Label>
                <Input type="number" value={pricingForm.min_quantity} onChange={(e) => setPricingForm({ ...pricingForm, min_quantity: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Max Quantity</Label>
                <Input type="number" value={pricingForm.max_quantity} onChange={(e) => setPricingForm({ ...pricingForm, max_quantity: e.target.value })} placeholder="No limit" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={pricingForm.description} onChange={(e) => setPricingForm({ ...pricingForm, description: e.target.value })} rows={2} />
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
              Pricing tiers require admin approval before becoming active.
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closePricingModal}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingPricing ? 'Update' : 'Submit for Approval'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}