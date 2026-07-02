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

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800 border-amber-300',
  quoted: 'bg-blue-100 text-blue-800 border-blue-300',
  confirmed: 'bg-green-100 text-green-800 border-green-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-300',
};

function RFPWizard({ onClose, suppliers, categories, _services }) {
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [rfp, setRfp] = useState({ service_name: '', description: '', quantity: 1, unit: 'per_person', notes: '', deadline: '' });
  const queryClient = useQueryClient();

  const sendRFP = /** @type {any} */ (useMutation({
    mutationFn: data => db.entities.BookingRequest.create(data),
    onSuccess: () => { showSuccess('RFP sent'); queryClient.invalidateQueries({ queryKey: ['bookingRequests'] }); onClose(); },
    onError: (error) => showError('Failed to send RFP', error.message)
  }));

  const filteredSuppliers = selectedCategory
    ? suppliers.filter(s => s.category_id === selectedCategory)
    : suppliers;

  const handleSend = () => {
    selectedSuppliers.forEach(supplierId => {
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
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= s ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
            }`}>{s}</div>
            <span className={`text-xs ${step >= s ? 'text-blue-600 font-medium' : 'text-slate-400'}`}>
              {s === 1 ? 'Service' : s === 2 ? 'Suppliers' : 'Review'}
            </span>
            {s < 3 && <div className="w-8 h-px bg-slate-300" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Service Details</h3>
          <Input placeholder="Service name" value={rfp.service_name} onChange={e => setRfp({...rfp, service_name: e.target.value})} />
          <Textarea placeholder="Description" value={rfp.description} onChange={e => setRfp({...rfp, description: e.target.value})} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Quantity</label>
              <Input type="number" min={1} value={rfp.quantity} onChange={e => setRfp({...rfp, quantity: parseInt(e.target.value) || 1})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Unit</label>
              <Select value={rfp.unit} onValueChange={v => setRfp({...rfp, unit: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_person">Per Person</SelectItem>
                  <SelectItem value="per_night">Per Night</SelectItem>
                  <SelectItem value="per_day">Per Day</SelectItem>
                  <SelectItem value="flat_rate">Flat Rate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Deadline for quotes</label>
            <Input type="date" value={rfp.deadline} onChange={e => setRfp({...rfp, deadline: e.target.value})} />
          </div>
          <Textarea placeholder="Additional notes for suppliers" value={rfp.notes} onChange={e => setRfp({...rfp, notes: e.target.value})} />
          <div className="flex justify-end">
            <Button disabled={!rfp.service_name} onClick={() => setStep(2)}>Next →</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Select Suppliers</h3>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Filter by category</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredSuppliers.map(s => {
              const checked = selectedSuppliers.includes(s.id);
              return (
                <label key={s.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  checked ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}>
                  <input type="checkbox" checked={checked} onChange={() => setSelectedSuppliers(
                    checked ? selectedSuppliers.filter(id => id !== s.id) : [...selectedSuppliers, s.id]
                  )} className="rounded" />
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.city} {s.area ? `· ${s.area}` : ''}</p>
                  </div>
                  <Badge className="ml-auto">{categories.find(c => c.id === s.category_id)?.name || ''}</Badge>
                </label>
              );
            })}
            {filteredSuppliers.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No suppliers found</p>}
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
            <Button disabled={selectedSuppliers.length === 0} onClick={() => setStep(3)}>
              Next ({selectedSuppliers.length} selected) →
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Review & Send</h3>
          <Card className="p-3 bg-slate-50 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Service:</span><span className="font-medium">{rfp.service_name}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Quantity:</span><span className="font-medium">{rfp.quantity} {rfp.unit}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Deadline:</span><span className="font-medium">{rfp.deadline || 'Not set'}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Suppliers:</span><span className="font-medium">{selectedSuppliers.length}</span></div>
          </Card>
          <div className="flex gap-1.5 flex-wrap">
            {selectedSuppliers.map(id => {
              const s = suppliers.find(sp => sp.id === id);
              return s ? <Badge key={id} className="bg-blue-100 text-blue-700">{s.name}</Badge> : null;
            })}
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSend} disabled={sendRFP.isPending}>
              <SendHorizontal className="w-4 h-4 mr-2" />
              Send RFP to {selectedSuppliers.length} supplier{selectedSuppliers.length > 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RFPManager() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [filter, setFilter] = useState('all');

  const { data: requests = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['bookingRequests'],
    queryFn: () => db.entities.BookingRequest.list(),
  }));

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['suppliers'],
    queryFn: () => db.entities.Supplier.list(),
  }));

  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['supplierCategories'],
    queryFn: () => db.entities.SupplierCategory.list(),
  }));

  const { data: services = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['serviceTemplates'],
    queryFn: () => db.entities.ServiceTemplate.list(),
  }));

  const updateStatus = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ { id, /** @type {any} */ data }) => db.entities.BookingRequest.update(id, data),
    onSuccess: () => { showSuccess('RFP status updated'); queryClient.invalidateQueries({ queryKey: ['bookingRequests'] }); },
    onError: (error) => showError('Failed to update RFP status', error.message)
  }));

  const queryClient = useQueryClient();

  const filtered = requests.filter(r => filter === 'all' || r.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-teal-100 p-2.5 rounded-xl">
            <SendHorizontal className="w-6 h-6 text-teal-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Supplier RFP</h1>
            <p className="text-sm text-slate-500">Request quotes from multiple suppliers</p>
          </div>
        </div>
        <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setWizardOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> New RFP
          </Button>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>New RFP Request</DialogTitle></DialogHeader>
            <RFPWizard onClose={() => setWizardOpen(false)} suppliers={suppliers} categories={categories} _services={services} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        {['all', 'pending', 'quoted', 'confirmed', 'rejected', 'cancelled'].map(s => (
          <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" onClick={() => setFilter(s)}
            className={filter === s ? 'bg-teal-600' : ''}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && ` (${requests.filter(r => r.status === s).length})`}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card className="p-12 text-center text-slate-400">
            <SendHorizontal className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">No RFP requests</p>
            <p className="text-sm mt-1">Create a new RFP to request quotes from suppliers</p>
          </Card>
        ) : (
          filtered.map(req => {
            const supplier = suppliers.find(s => s.id === req.supplier_id);
            return (
              <Card key={req.id} className="p-4 bg-white flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Building2 className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <h4 className="font-medium">{req.service_name || 'Service Request'}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{supplier?.name || 'Unknown supplier'}</p>
                    {req.description && <p className="text-xs text-slate-400 mt-1">{req.description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={`text-[10px] ${STATUS_STYLES[req.status] || 'bg-slate-100'}`}>
                        {req.status || 'pending'}
                      </Badge>
                      {req.quantity && <span className="text-[10px] text-slate-400">Qty: {req.quantity}</span>}
                      {req.deadline && <span className="text-[10px] text-slate-400">Due: {req.deadline}</span>}
                    </div>
                  </div>
                </div>
                {req.status === 'pending' && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-8 text-xs text-green-600" onClick={() => updateStatus.mutate({ id: req.id, data: { ...req, status: 'quoted' } })}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Quoted
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs text-red-600" onClick={() => updateStatus.mutate({ id: req.id, data: { ...req, status: 'cancelled' } })}>
                      <XCircle className="w-3 h-3 mr-1" /> Cancel
                    </Button>
                  </div>
                )}
                {req.status === 'quoted' && (
                  <Button size="sm" className="h-8 text-xs bg-teal-600" onClick={() => updateStatus.mutate({ id: req.id, data: { ...req, status: 'confirmed' } })}>
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Confirm
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
