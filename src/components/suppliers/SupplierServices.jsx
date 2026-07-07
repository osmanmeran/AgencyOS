import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const STATUS_COLORS = {
  quoted: 'bg-muted text-foreground',
  booked: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
  paid: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  cancelled: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
};

export default function SupplierServices({ supplierId }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    service_name: '',
    description: '',
    budgeted_cost: '',
    actual_cost: '',
    currency: 'USD',
    unit: 'per trip',
    status: 'quoted',
    notes: '',
  });
  const queryClient = useQueryClient();

  const { data: services = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierServices', supplierId],
      queryFn: () => db.entities.SupplierService.filter({ supplier_id: supplierId }),
    })
  );

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.SupplierService.create({ ...data, supplier_id: supplierId }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['supplierServices', supplierId] });
        closeModal();
      },
    })
  );

  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) => db.entities.SupplierService.update(id, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['supplierServices', supplierId] });
        closeModal();
      },
    })
  );

  const deleteMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ id) => db.entities.SupplierService.delete(id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supplierServices', supplierId] }),
    })
  );

  const openModal = (service = null) => {
    if (service) {
      setEditingService(service);
      setFormData({
        service_name: service.service_name || '',
        description: service.description || '',
        budgeted_cost: service.budgeted_cost || '',
        actual_cost: service.actual_cost || '',
        currency: service.currency || 'USD',
        unit: service.unit || 'per trip',
        status: service.status || 'quoted',
        notes: service.notes || '',
      });
    } else {
      setEditingService(null);
      setFormData({
        service_name: '',
        description: '',
        budgeted_cost: '',
        actual_cost: '',
        currency: 'USD',
        unit: 'per trip',
        status: 'quoted',
        notes: '',
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingService(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      budgeted_cost: formData.budgeted_cost ? parseFloat(formData.budgeted_cost) : undefined,
      actual_cost: formData.actual_cost ? parseFloat(formData.actual_cost) : undefined,
    };
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const totalBudgeted = services.reduce((sum, s) => sum + (s.budgeted_cost || 0), 0);
  const totalActual = services.reduce((sum, s) => sum + (s.actual_cost || 0), 0);
  const variance = totalActual - totalBudgeted;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">Services & Cost Tracking</h3>
        <Button onClick={() => openModal()} size="sm" className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Service
        </Button>
      </div>

      {services.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800">
            <div className="text-sm text-muted-foreground mb-1">Total Budgeted</div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">${totalBudgeted.toFixed(2)}</div>
          </Card>
          <Card className="p-4 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800">
            <div className="text-sm text-muted-foreground mb-1">Total Actual</div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">${totalActual.toFixed(2)}</div>
          </Card>
          <Card
            className={`p-4 ${variance > 0 ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800' : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'}`}
          >
            <div className="text-sm text-muted-foreground mb-1">Variance</div>
            <div
              className={`text-2xl font-bold flex items-center gap-2 ${variance > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}
            >
              {variance > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}$
              {Math.abs(variance).toFixed(2)}
            </div>
          </Card>
        </div>
      )}

      {services.length === 0 ? (
        <Card className="p-8 text-center bg-card">
          <p className="text-muted-foreground mb-4">No services added yet</p>
          <Button onClick={() => openModal()} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add First Service
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {services.map((service) => {
            const serviceDiff = (service.actual_cost || 0) - (service.budgeted_cost || 0);
            return (
              <Card key={service.id} className="p-4 hover:shadow-md transition-shadow group">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-foreground">{service.service_name}</h4>
                      <Badge className={STATUS_COLORS[service.status]}>{service.status}</Badge>
                    </div>
                    {service.description && <p className="text-sm text-muted-foreground mb-2">{service.description}</p>}
                    <div className="text-sm text-muted-foreground">{service.unit}</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Budgeted</div>
                      <div className="font-semibold text-blue-700 dark:text-blue-300">
                        ${(service.budgeted_cost || 0).toFixed(2)}
                      </div>
                      {service.actual_cost > 0 && (
                        <>
                          <div className="text-xs text-muted-foreground mt-1">Actual</div>
                          <div className="font-semibold text-green-700 dark:text-green-300">
                            ${service.actual_cost.toFixed(2)}
                          </div>
                          {serviceDiff !== 0 && (
                            <div
                              className={`text-xs mt-1 ${serviceDiff > 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}`}
                            >
                              {serviceDiff > 0 ? '+' : ''}
                              {serviceDiff.toFixed(2)}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => openModal(service)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(service.id)}>
                        <Trash2 className="w-4 h-4 text-red-500 dark:text-red-300" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Edit Service' : 'Add Service'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="service_name">Service Name *</Label>
              <Input
                id="service_name"
                value={formData.service_name}
                onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budgeted_cost">Budgeted Cost *</Label>
                <Input
                  id="budgeted_cost"
                  type="number"
                  step="0.01"
                  value={formData.budgeted_cost}
                  onChange={(e) => setFormData({ ...formData, budgeted_cost: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actual_cost">Actual Cost</Label>
                <Input
                  id="actual_cost"
                  type="number"
                  step="0.01"
                  value={formData.actual_cost}
                  onChange={(e) => setFormData({ ...formData, actual_cost: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="per person, per night, etc."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quoted">Quoted</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingService ? 'Update' : 'Add'} Service
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
