import { db } from '@/lib/DbContext';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { SkeletonCard } from '@/components/ui/skeletons';
import { ArrowLeft, Plus, Trash2, Check, Search, Loader2 } from 'lucide-react';
import { createPageUrl } from '../utils';
import { showSuccess, showError } from '@/lib/toast';
import ContractItineraryRow from '../components/contracts/ContractItineraryRow';

const emptyItem = () => ({
  _key: `line-${Date.now()}-${Math.random()}`,
  category: '',
  supplier_id: '',
  name: '',
  description: '',
  location: '',
  day_offset_start: 0,
  day_offset_end: 0,
  unit: 'per_person',
  quantity: 1,
  acquiring_price: '',
  supplier_currency: 'EUR',
  show_in_itinerary: true,
});

const emptyTier = () => ({
  _key: `tier-${Date.now()}-${Math.random()}`,
  pax: '',
  price_per_person: '',
  currency: 'EUR',
});

const emptyContract = {
  name: '',
  client_id: '',
  client_name: '',
  destination: '',
  itinerary: [emptyItem()],
  pricing_tiers: [emptyTier()],
  terms_and_conditions: '',
  notes: '',
  is_active: true,
};

export default function TourContractForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const isEditing = !!editId;

  const [form, setForm] = useState(emptyContract);
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);

  const { data: editContract, isLoading: editLoading } = /** @type {any} */ (
    useQuery({
      queryKey: ['TourContract', editId],
      queryFn: () => db.entities.TourContract.get(editId),
      enabled: isEditing,
    })
  );

  useEffect(() => {
    if (!editContract) return;
    setForm({
      name: editContract.name || '',
      client_id: editContract.client_id || '',
      client_name: editContract.client_name || '',
      destination: editContract.destination || '',
      itinerary: editContract.itinerary?.length ? editContract.itinerary : [emptyItem()],
      pricing_tiers: editContract.pricing_tiers?.length ? editContract.pricing_tiers : [emptyTier()],
      terms_and_conditions: editContract.terms_and_conditions || '',
      notes: editContract.notes || '',
      is_active: editContract.is_active !== false,
    });
  }, [editContract]);

  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierCategories'],
      queryFn: () => db.entities.SupplierCategory.list(),
    })
  );
  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clients'],
      queryFn: () => db.entities.Client.list(),
    })
  );
  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter((c) => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q));
  }, [clients, clientSearch]);

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.TourContract.create(data),
      onSuccess: (/** @type {any} */ created) => {
        showSuccess('Contract created');
        queryClient.invalidateQueries({ queryKey: ['TourContract'] });
        navigate(createPageUrl(`TourContractForm?id=${created.id}`));
      },
      onError: (error) => showError('Failed to create contract', error.message),
    })
  );

  const updateMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.TourContract.update(editId, data),
      onSuccess: () => {
        showSuccess('Contract updated');
        queryClient.invalidateQueries({ queryKey: ['TourContract'] });
        queryClient.invalidateQueries({ queryKey: ['TourContract', editId] });
        navigate(createPageUrl('TourContracts'));
      },
      onError: (error) => showError('Failed to update contract', error.message),
    })
  );

  const addItem = () => setForm((f) => ({ ...f, itinerary: [...f.itinerary, emptyItem()] }));
  const updateItem = (key, updated) =>
    setForm((f) => ({ ...f, itinerary: f.itinerary.map((i) => (i._key === key ? updated : i)) }));
  const removeItem = (key) => setForm((f) => ({ ...f, itinerary: f.itinerary.filter((i) => i._key !== key) }));
  const duplicateItem = (key) =>
    setForm((f) => {
      const idx = f.itinerary.findIndex((i) => i._key === key);
      if (idx === -1) return f;
      const copy = { ...f.itinerary[idx], _key: `line-${Date.now()}-${Math.random()}` };
      const next = [...f.itinerary];
      next.splice(idx + 1, 0, copy);
      return { ...f, itinerary: next };
    });

  const addTier = () => setForm((f) => ({ ...f, pricing_tiers: [...f.pricing_tiers, emptyTier()] }));
  const updateTier = (key, field, value) =>
    setForm((f) => ({
      ...f,
      pricing_tiers: f.pricing_tiers.map((t) => (t._key === key ? { ...t, [field]: value } : t)),
    }));
  const removeTier = (key) => setForm((f) => ({ ...f, pricing_tiers: f.pricing_tiers.filter((t) => t._key !== key) }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanItinerary = form.itinerary
      .filter((i) => i.category && i.supplier_id)
      .map((i) => ({ ...i, acquiring_price: parseFloat(i.acquiring_price) || 0 }));
    const cleanTiers = form.pricing_tiers
      .filter((t) => t.pax !== '' && t.price_per_person !== '')
      .map((t) => ({ ...t, pax: parseInt(t.pax), price_per_person: parseFloat(t.price_per_person) }));

    const payload = { ...form, itinerary: cleanItinerary, pricing_tiers: cleanTiers };

    if (isEditing) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  if (isEditing && editLoading) return <SkeletonCard />;

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link to={createPageUrl('TourContracts')}>
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Tour Contracts
        </Button>
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-foreground">{isEditing ? 'Edit Tour Contract' : 'New Tour Contract'}</h1>
        <p className="text-muted-foreground mt-1">
          Define the fixed itinerary and per-person pricing tiers for a recurring serial tour
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 bg-card shadow-md">
          <h2 className="text-lg font-bold text-foreground mb-4">Contract Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contract Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Istanbul Classic 4D/3N"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Destination</Label>
              <Input
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                placeholder="e.g., Istanbul, Turkey"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Client *</Label>
              <Popover open={clientDropdownOpen} onOpenChange={setClientDropdownOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    className="w-full flex items-center justify-between px-3 py-2 text-sm border border-border rounded-lg bg-card hover:bg-muted text-left"
                  >
                    {form.client_id ? (
                      <span className="font-medium">{form.client_name}</span>
                    ) : (
                      <span className="text-muted-foreground">Select client...</span>
                    )}
                    <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search clients..."
                      value={clientSearch}
                      onValueChange={setClientSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No clients found</CommandEmpty>
                      <CommandGroup>
                        {filteredClients.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.name} ${c.email || ''}`}
                            onSelect={() => {
                              setForm({ ...form, client_id: c.id, client_name: c.name || '' });
                              setClientSearch('');
                              setClientDropdownOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${form.client_id === c.id ? 'opacity-100' : 'opacity-0'}`}
                            />
                            <span className="font-medium">{c.name}</span>
                            {c.email && <span className="text-muted-foreground ml-1">— {c.email}</span>}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.is_active ? 'active' : 'inactive'}
                onValueChange={(v) => setForm({ ...form, is_active: v === 'active' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card shadow-md">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">Fixed Itinerary</h2>
              <p className="text-sm text-muted-foreground">
                The suppliers and services every booking from this contract will include
              </p>
            </div>
            <Button type="button" onClick={addItem} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Line
            </Button>
          </div>
          <div className="space-y-4">
            {form.itinerary.map((item) => (
              <ContractItineraryRow
                key={item._key}
                item={item}
                categories={categories}
                onUpdate={(updated) => updateItem(item._key, updated)}
                onRemove={() => removeItem(item._key)}
                onDuplicate={() => duplicateItem(item._key)}
              />
            ))}
          </div>
        </Card>

        <Card className="p-6 bg-card shadow-md">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">Pricing Tiers</h2>
              <p className="text-sm text-muted-foreground">Fixed price per person for each exact participant count</p>
            </div>
            <Button type="button" onClick={addTier} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Tier
            </Button>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 text-xs font-semibold text-muted-foreground uppercase px-1">
              <span>Participants</span>
              <span>Price / Person</span>
              <span>Currency</span>
              <span></span>
            </div>
            {form.pricing_tiers.map((tier) => (
              <div key={tier._key} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center">
                <Input
                  type="number"
                  min="1"
                  value={tier.pax}
                  onChange={(e) => updateTier(tier._key, 'pax', e.target.value)}
                  placeholder="e.g., 2"
                  required
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tier.price_per_person}
                  onChange={(e) => updateTier(tier._key, 'price_per_person', e.target.value)}
                  placeholder="0.00"
                  required
                />
                <Select value={tier.currency} onValueChange={(v) => updateTier(tier._key, 'currency', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['EUR', 'USD', 'GBP', 'TRY', 'AED'].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeTier(tier._key)}>
                  <Trash2 className="w-4 h-4 text-red-400" />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 bg-card shadow-md">
          <h2 className="text-lg font-bold text-foreground mb-4">Terms &amp; Notes</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Terms &amp; Conditions</Label>
              <Textarea
                value={form.terms_and_conditions}
                onChange={(e) => setForm({ ...form, terms_and_conditions: e.target.value })}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Internal Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3 pb-8">
          <Link to={createPageUrl('TourContracts')}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={saving || !form.client_id}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : isEditing ? (
              'Save Changes'
            ) : (
              'Create Contract'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
