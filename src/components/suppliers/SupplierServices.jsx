import { db } from '@/lib/DbContext';

import { useState, useMemo } from 'react';
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
import { useT } from '@/lib/i18n/I18nContext';
import { ensureCategoryByName, ensureSupplierSubcategory, GUIDED_TOURS_NAME } from '@/lib/supplierCategories';

const STATUS_COLORS = {
  quoted: 'bg-muted text-foreground',
  booked: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
  paid: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  cancelled: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
};

export default function SupplierServices({ supplierId }) {
  const { t } = useT();
  const STATUS_LABEL_KEYS = {
    quoted: 'supplierServices.statusQuoted',
    booked: 'supplierServices.statusBooked',
    paid: 'supplierServices.statusPaid',
    cancelled: 'supplierServices.statusCancelled',
  };
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
    subcategory_id: '',
    notes: '',
  });
  const queryClient = useQueryClient();

  const { data: services = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierServices', supplierId],
      queryFn: () => db.entities.SupplierService.filter({ supplier_id: supplierId }),
    })
  );

  const { data: allCategories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierCategories'],
      queryFn: () => db.entities.SupplierCategory.list(),
    })
  );
  const { data: mySubs = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierSubcategories', supplierId],
      queryFn: () => db.entities.SupplierSubcategory.filter({ supplier_id: supplierId }),
    })
  );

  // Categories the supplier is already assigned to...
  const assignedCategories = useMemo(() => {
    const ids = new Set((mySubs || []).map((s) => s.category_id));
    return (allCategories || []).filter((c) => ids.has(c.id));
  }, [allCategories, mySubs]);

  // ...plus the Guided Tours category if it exists, so it can be picked even
  // before the supplier is first assigned to it.
  const guidedTourCat = useMemo(
    () => (allCategories || []).find((c) => c.name?.toLowerCase() === GUIDED_TOURS_NAME.toLowerCase()),
    [allCategories],
  );
  const categoryOptions = useMemo(() => {
    const opts = [...assignedCategories];
    if (guidedTourCat && !opts.some((c) => c.id === guidedTourCat.id)) opts.push(guidedTourCat);
    return opts;
  }, [assignedCategories, guidedTourCat]);

  const [selectedCategoryId, setSelectedCategoryId] = useState('');

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

  const openModal = async (service = null) => {
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
        subcategory_id: service.subcategory_id || '',
        notes: service.notes || '',
      });
      setSelectedCategoryId(
        service.subcategory_id ? mySubs.find((s) => s.id === service.subcategory_id)?.category_id || '' : '',
      );
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
        subcategory_id: '',
        notes: '',
      });
      // Make sure the Guided Tours category exists so it can be picked even
      // before this supplier is first assigned to it.
      await ensureCategoryByName(db, GUIDED_TOURS_NAME);
      queryClient.invalidateQueries({ queryKey: ['supplierCategories'] });
      // Default: if the supplier has exactly one category, pre-select it.
      setSelectedCategoryId(assignedCategories.length === 1 ? assignedCategories[0].id : '');
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingService(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let subcategory_id = formData.subcategory_id;
    // Assign the supplier to the chosen category (auto-create the link if needed)
    // so the service is filed under the right category's pricing tool. Also
    // covers edits where the user picked a different category than the one
    // the service is currently filed under.
    const currentCategoryId = subcategory_id ? mySubs.find((s) => s.id === subcategory_id)?.category_id || '' : '';
    if (selectedCategoryId && selectedCategoryId !== currentCategoryId) {
      const cat = categoryOptions.find((c) => c.id === selectedCategoryId);
      if (cat) {
        const sub = await ensureSupplierSubcategory(db, supplierId, cat.id, cat.name);
        subcategory_id = sub.id;
        queryClient.invalidateQueries({ queryKey: ['supplierSubcategories', supplierId] });
        queryClient.invalidateQueries({ queryKey: ['allSupplierSubcategories'] });
      }
    }
    const data = {
      ...formData,
      subcategory_id,
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
        <h3 className="text-lg font-semibold text-foreground">{t('supplierServices.title')}</h3>
        <Button onClick={() => openModal()} size="sm" className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          {t('supplierServices.addService')}
        </Button>
      </div>

      {services.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800">
            <div className="text-sm text-muted-foreground mb-1">{t('supplierServices.totalBudgeted')}</div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">${totalBudgeted.toFixed(2)}</div>
          </Card>
          <Card className="p-4 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800">
            <div className="text-sm text-muted-foreground mb-1">{t('supplierServices.totalActual')}</div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">${totalActual.toFixed(2)}</div>
          </Card>
          <Card
            className={`p-4 ${variance > 0 ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800' : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'}`}
          >
            <div className="text-sm text-muted-foreground mb-1">{t('supplierServices.variance')}</div>
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
          <p className="text-muted-foreground mb-4">{t('supplierServices.noServices')}</p>
          <Button onClick={() => openModal()} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            {t('supplierServices.addFirstService')}
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
                      <Badge className={STATUS_COLORS[service.status]}>
                        {STATUS_LABEL_KEYS[service.status] ? t(STATUS_LABEL_KEYS[service.status]) : service.status}
                      </Badge>
                    </div>
                    {service.description && <p className="text-sm text-muted-foreground mb-2">{service.description}</p>}
                    <div className="text-sm text-muted-foreground">{service.unit}</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">{t('supplierServices.budgetedLabel')}</div>
                      <div className="font-semibold text-blue-700 dark:text-blue-300">
                        ${(service.budgeted_cost || 0).toFixed(2)}
                      </div>
                      {service.actual_cost > 0 && (
                        <>
                          <div className="text-xs text-muted-foreground mt-1">{t('supplierServices.actualLabel')}</div>
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
            <DialogTitle>
              {editingService ? t('supplierServices.editServiceTitle') : t('supplierServices.addService')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="service_name">{t('supplierServices.serviceNameLabel')}</Label>
              <Input
                id="service_name"
                value={formData.service_name}
                onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
                required
              />
            </div>

            {categoryOptions.length > 1 && (
              <div className="space-y-2">
                <Label>{t('supplierServices.categoryLabel')}</Label>
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId} required>
                  <SelectTrigger>
                    <SelectValue placeholder={t('supplierServices.selectCategoryPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t('supplierServices.categoryHint')}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">{t('supplierServices.descriptionLabel')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budgeted_cost">{t('supplierServices.budgetedCostLabel')}</Label>
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
                <Label htmlFor="actual_cost">{t('supplierServices.actualCostLabel')}</Label>
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
                <Label htmlFor="currency">{t('supplierServices.currencyLabel')}</Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">{t('supplierServices.unitLabel')}</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder={t('supplierServices.unitPlaceholder')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">{t('supplierServices.statusLabel')}</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quoted">{t('supplierServices.statusQuoted')}</SelectItem>
                  <SelectItem value="booked">{t('supplierServices.statusBooked')}</SelectItem>
                  <SelectItem value="paid">{t('supplierServices.statusPaid')}</SelectItem>
                  <SelectItem value="cancelled">{t('supplierServices.statusCancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('common.notes')}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeModal}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingService ? t('supplierServices.updateServiceButton') : t('supplierServices.addService')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
