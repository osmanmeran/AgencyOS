import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SendHorizontal, CheckCircle2, XCircle, Building2, Plus } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { categoryIdsBySupplier, getSupplierCategoryIds } from '@/lib/supplierCategories';
import { useT } from '@/lib/i18n/I18nContext';

const STATUS_STYLES = {
  pending:
    'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  quoted: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
  confirmed:
    'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-300 dark:border-green-800',
  rejected: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

function RFPWizard({ onClose, suppliers, categories }) {
  const { t } = useT();
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [rfp, setRfp] = useState({
    service_name: '',
    description: '',
    quantity: 1,
    unit: 'per_person',
    notes: '',
    deadline: '',
  });
  const queryClient = useQueryClient();

  const { data: subcategories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['allSupplierSubcategories'],
      queryFn: () => db.entities.SupplierSubcategory.list(),
    })
  );
  const supplierCategoryMap = categoryIdsBySupplier(subcategories);

  const sendRFP = /** @type {any} */ (
    useMutation({
      mutationFn: (data) => db.entities.BookingRequest.create(data),
      onSuccess: () => {
        showSuccess(t('rfpManager.rfpSentSuccess'));
        queryClient.invalidateQueries({ queryKey: ['bookingRequests'] });
        onClose();
      },
      onError: (error) => showError(t('rfpManager.rfpSentError'), error.message),
    })
  );

  const filteredSuppliers = selectedCategory
    ? suppliers.filter((s) => getSupplierCategoryIds(supplierCategoryMap, s.id).includes(selectedCategory))
    : suppliers;

  const handleSend = () => {
    selectedSuppliers.forEach((supplierId) => {
      sendRFP.mutate({
        supplier_id: supplierId,
        service_name: rfp.service_name,
        description: rfp.description,
        quantity: rfp.quantity,
        unit: rfp.unit,
        notes: rfp.notes,
        deadline: rfp.deadline,
        status: 'pending',
        service_date: rfp.deadline,
      });
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              {s}
            </div>
            <span
              className={`text-xs ${step >= s ? 'text-blue-600 dark:text-blue-300 font-medium' : 'text-muted-foreground'}`}
            >
              {s === 1
                ? t('rfpManager.wizard.stepService')
                : s === 2
                  ? t('rfpManager.wizard.stepSuppliers')
                  : t('rfpManager.wizard.stepReview')}
            </span>
            {s < 3 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <h3 className="font-semibold">{t('rfpManager.wizard.serviceDetails')}</h3>
          <Input
            placeholder={t('rfpManager.wizard.serviceNamePlaceholder')}
            value={rfp.service_name}
            onChange={(e) => setRfp({ ...rfp, service_name: e.target.value })}
          />
          <Textarea
            placeholder={t('rfpManager.wizard.descriptionPlaceholder')}
            value={rfp.description}
            onChange={(e) => setRfp({ ...rfp, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('common.quantity')}</label>
              <Input
                type="number"
                min={1}
                value={rfp.quantity}
                onChange={(e) => setRfp({ ...rfp, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('rfpManager.wizard.unitLabel')}</label>
              <Select value={rfp.unit} onValueChange={(v) => setRfp({ ...rfp, unit: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_person">{t('units.perPerson')}</SelectItem>
                  <SelectItem value="per_night">{t('units.perNight')}</SelectItem>
                  <SelectItem value="per_day">{t('units.perDay')}</SelectItem>
                  <SelectItem value="flat_rate">{t('units.flatRate')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('rfpManager.wizard.deadlineLabel')}</label>
            <Input type="date" value={rfp.deadline} onChange={(e) => setRfp({ ...rfp, deadline: e.target.value })} />
          </div>
          <Textarea
            placeholder={t('rfpManager.wizard.additionalNotesPlaceholder')}
            value={rfp.notes}
            onChange={(e) => setRfp({ ...rfp, notes: e.target.value })}
          />
          <div className="flex justify-end">
            <Button disabled={!rfp.service_name} onClick={() => setStep(2)}>
              {t('rfpManager.wizard.next')}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <h3 className="font-semibold">{t('rfpManager.wizard.selectSuppliers')}</h3>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('rfpManager.wizard.filterByCategory')}</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder={t('rfpManager.wizard.allCategories')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredSuppliers.map((s) => {
              const checked = selectedSuppliers.includes(s.id);
              return (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    checked
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800'
                      : 'bg-card border-border hover:bg-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedSuppliers(
                        checked ? selectedSuppliers.filter((id) => id !== s.id) : [...selectedSuppliers, s.id],
                      )
                    }
                    className="rounded"
                  />
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.city} {s.area ? `· ${s.area}` : ''}
                    </p>
                  </div>
                  <div className="ml-auto flex gap-1 flex-wrap justify-end">
                    {getSupplierCategoryIds(supplierCategoryMap, s.id).map((cid) => (
                      <Badge key={cid}>{categories.find((c) => c.id === cid)?.name || ''}</Badge>
                    ))}
                  </div>
                </label>
              );
            })}
            {filteredSuppliers.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t('rfpManager.wizard.noSuppliersFound')}
              </p>
            )}
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              {t('rfpManager.wizard.back')}
            </Button>
            <Button disabled={selectedSuppliers.length === 0} onClick={() => setStep(3)}>
              {t('rfpManager.wizard.nextSelected', { count: selectedSuppliers.length })}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <h3 className="font-semibold">{t('rfpManager.wizard.reviewAndSend')}</h3>
          <Card className="p-3 bg-muted space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('rfpManager.wizard.serviceLabel')}</span>
              <span className="font-medium">{rfp.service_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('rfpManager.wizard.quantityLabel')}</span>
              <span className="font-medium">
                {rfp.quantity} {rfp.unit}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('rfpManager.wizard.deadlineReviewLabel')}</span>
              <span className="font-medium">{rfp.deadline || t('rfpManager.wizard.notSet')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('rfpManager.wizard.suppliersLabel')}</span>
              <span className="font-medium">{selectedSuppliers.length}</span>
            </div>
          </Card>
          <div className="flex gap-1.5 flex-wrap">
            {selectedSuppliers.map((id) => {
              const s = suppliers.find((sp) => sp.id === id);
              return s ? (
                <Badge key={id} className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {s.name}
                </Badge>
              ) : null;
            })}
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              {t('rfpManager.wizard.back')}
            </Button>
            <Button onClick={handleSend} disabled={sendRFP.isPending}>
              <SendHorizontal className="w-4 h-4 mr-2" />
              {t(
                selectedSuppliers.length === 1
                  ? 'rfpManager.wizard.sendRfpSingular'
                  : 'rfpManager.wizard.sendRfpPlural',
                { count: selectedSuppliers.length },
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RFPManager() {
  const { t } = useT();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [filter, setFilter] = useState('all');

  const { data: requests = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['bookingRequests'],
      queryFn: () => db.entities.BookingRequest.list(),
    })
  );

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['suppliers'],
      queryFn: () => db.entities.Supplier.list(),
    })
  );

  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierCategories'],
      queryFn: () => db.entities.SupplierCategory.list(),
    })
  );

  const updateStatus = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) => db.entities.BookingRequest.update(id, data),
      onSuccess: () => {
        showSuccess(t('rfpManager.statusUpdateSuccess'));
        queryClient.invalidateQueries({ queryKey: ['bookingRequests'] });
      },
      onError: (error) => showError(t('rfpManager.statusUpdateError'), error.message),
    })
  );

  const queryClient = useQueryClient();

  const filtered = requests.filter((r) => filter === 'all' || r.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-teal-100 dark:bg-teal-900/40 p-2.5 rounded-xl">
            <SendHorizontal className="w-6 h-6 text-teal-700 dark:text-teal-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('rfpManager.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('rfpManager.subtitle')}</p>
          </div>
        </div>
        <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setWizardOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> {t('rfpManager.newRfp')}
          </Button>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{t('rfpManager.newRfpDialogTitle')}</DialogTitle>
            </DialogHeader>
            <RFPWizard onClose={() => setWizardOpen(false)} suppliers={suppliers} categories={categories} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        {['all', 'pending', 'quoted', 'confirmed', 'rejected', 'cancelled'].map((s) => (
          <Button
            key={s}
            variant={filter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(s)}
            className={filter === s ? 'bg-teal-600' : ''}
          >
            {t(`common.${s}`)}
            {s !== 'all' && ` (${requests.filter((r) => r.status === s).length})`}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <SendHorizontal className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">{t('rfpManager.noRfpRequests')}</p>
            <p className="text-sm mt-1">{t('rfpManager.noRfpRequestsBody')}</p>
          </Card>
        ) : (
          filtered.map((req) => {
            const supplier = suppliers.find((s) => s.id === req.supplier_id);
            return (
              <Card key={req.id} className="p-4 bg-card flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="font-medium">{req.service_name || t('rfpManager.serviceRequestFallback')}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {supplier?.name || t('rfpManager.unknownSupplier')}
                    </p>
                    {req.description && <p className="text-xs text-muted-foreground mt-1">{req.description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={`text-[10px] ${STATUS_STYLES[req.status] || 'bg-muted'}`}>
                        {t(`common.${req.status || 'pending'}`)}
                      </Badge>
                      {req.quantity && (
                        <span className="text-[10px] text-muted-foreground">
                          {t('rfpManager.qty', { qty: req.quantity })}
                        </span>
                      )}
                      {req.deadline && (
                        <span className="text-[10px] text-muted-foreground">
                          {t('rfpManager.due', { date: req.deadline })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {req.status === 'pending' && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-green-600 dark:text-green-300"
                      onClick={() => updateStatus.mutate({ id: req.id, data: { ...req, status: 'quoted' } })}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" /> {t('rfpManager.markQuoted')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-red-600 dark:text-red-300"
                      onClick={() => updateStatus.mutate({ id: req.id, data: { ...req, status: 'cancelled' } })}
                    >
                      <XCircle className="w-3 h-3 mr-1" /> {t('common.cancel')}
                    </Button>
                  </div>
                )}
                {req.status === 'quoted' && (
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-teal-600"
                    onClick={() => updateStatus.mutate({ id: req.id, data: { ...req, status: 'confirmed' } })}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" /> {t('rfpManager.confirm')}
                  </Button>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
