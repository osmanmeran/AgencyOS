import { db } from '@/lib/DbContext';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, AlertTriangle, Loader2, Users, Calendar } from 'lucide-react';
import { createPageUrl } from '../utils';
import { showSuccess, showError } from '@/lib/toast';
import { generateReferenceNumber } from '@/lib/referenceNumber';
import { buildTripFromContract } from '@/lib/contractBooking';

const currSymbol = (cur) => ({ USD: '$', EUR: '€', GBP: '£', TRY: '₺', AED: 'د.إ' }[cur] || cur);

export default function GenerateFromContract() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [contractId, setContractId] = useState(searchParams.get('contract_id') || '');
  const [departureDate, setDepartureDate] = useState('');
  const [numParticipants, setNumParticipants] = useState(2);
  const [selectedExtraKeys, setSelectedExtraKeys] = useState(/** @type {string[]} */ ([]));

  const { data: contracts = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['TourContract'], queryFn: () => db.entities.TourContract.list(),
  }));
  const activeContracts = contracts.filter(c => c.is_active !== false);
  const contract = contracts.find(c => c.id === contractId) || null;

  const { data: client } = /** @type {any} */ (useQuery({
    queryKey: ['client', contract?.client_id],
    queryFn: () => db.entities.Client.get(contract.client_id),
    enabled: !!contract?.client_id,
  }));

  const { data: settings } = /** @type {any} */ (useQuery({
    queryKey: ['appSettings'],
    queryFn: async () => { const all = await db.entities.AppSettings.list(); return all[0] || {}; },
  }));
  const { data: currentUser } = /** @type {any} */ (useQuery({ queryKey: ['me'], queryFn: () => db.auth.me() }));

  const preview = useMemo(() => {
    if (!contract || !client || !departureDate || !numParticipants) return null;
    return buildTripFromContract({ contract, client, departureDate, numParticipants, selectedExtraKeys });
  }, [contract, client, departureDate, numParticipants, selectedExtraKeys]);

  const createMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ data) => db.entities.Trip.create(data),
    onSuccess: (/** @type {any} */ created) => {
      showSuccess('Reservation created from contract');
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      navigate(createPageUrl(`ReservationDetails?id=${created.id}`));
    },
    onError: (error) => showError('Failed to create reservation', error.message),
  }));

  const toggleExtra = (key) => setSelectedExtraKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const handleCreate = async () => {
    if (!preview?.ok) return;
    const referenceNumber = await generateReferenceNumber('', settings);
    createMutation.mutate({
      ...preview.tripBase,
      reference_number: referenceNumber,
      proposal_status: 'pending',
      status: 'planning',
      created_by: currentUser?.email || 'unknown',
      created_by_name: currentUser?.name || currentUser?.email || 'Unknown',
      created_by_phone: currentUser?.phone || '',
      created_date: new Date().toISOString(),
      change_history: [{
        date: new Date().toISOString(),
        changed_by: currentUser?.email || 'unknown',
        changed_by_name: currentUser?.name || currentUser?.email || 'Unknown',
        action: 'created',
        description: `Reservation generated from contract "${contract.name}"`,
      }],
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link to={createPageUrl('TourContracts')}>
        <Button variant="ghost" className="gap-2"><ArrowLeft className="w-4 h-4" />Back to Tour Contracts</Button>
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-slate-900">Generate Booking from Contract</h1>
        <p className="text-slate-500 mt-1">Pick a contract, a departure date and the number of participants — the itinerary and pricing fill in automatically</p>
      </div>

      <Card className="p-6 bg-white shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Tour Contract *</Label>
            <Select value={contractId} onValueChange={setContractId}>
              <SelectTrigger><SelectValue placeholder="Select a contract..." /></SelectTrigger>
              <SelectContent>
                {activeContracts.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.client_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {contract && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Client</Label>
                <p className="text-sm font-medium text-slate-900">{contract.client_name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Destination</Label>
                <p className="text-sm font-medium text-slate-900">{contract.destination || '—'}</p>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Departure Date *</Label>
            <Input type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />Participants *</Label>
            <Input type="number" min="1" value={numParticipants} onChange={e => setNumParticipants(parseInt(e.target.value) || 0)} required />
          </div>
        </div>

        {client?.fixed_extras?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <Label className="text-sm font-semibold text-slate-700 mb-2 block">Optional Extras for {client.name}</Label>
            <div className="space-y-2">
              {client.fixed_extras.map(extra => (
                <label key={extra._key} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-50">
                  <Checkbox checked={selectedExtraKeys.includes(extra._key)} onCheckedChange={() => toggleExtra(extra._key)} />
                  <span className="text-sm text-slate-700">{extra.name}</span>
                  <span className="text-xs text-slate-400 ml-auto">{currSymbol(extra.currency)}{extra.selling_price}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </Card>

      {contract && departureDate && numParticipants > 0 && preview?.missingTier && (
        <Card className="p-6 bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">No pricing tier for {numParticipants} participants</p>
              <p className="text-sm text-amber-700 mt-1">
                {preview.availablePax.length > 0
                  ? `This contract has pricing for: ${preview.availablePax.join(', ')} participants. Add a tier for ${numParticipants} in the contract, or adjust the participant count.`
                  : 'This contract has no pricing tiers configured yet. Add pricing tiers in the contract before generating a booking.'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {preview?.ok && (
        <Card className="p-6 bg-white shadow-md">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Preview</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Service</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Dates</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.services.map(s => (
                  <tr key={s._key}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{s.name || s.category}</div>
                      <div className="text-xs text-slate-400">{s.category}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{s.start_date}{s.end_date && s.end_date !== s.start_date ? ` → ${s.end_date}` : ''}</td>
                    <td className="px-3 py-2 text-slate-600">{s.quantity} {s.unit?.replace('per_', '/')}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{currSymbol(s.supplier_currency)}{((Number(s.acquiring_price) || 0) * (Number(s.quantity) || 1)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
            <div className="w-80 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Supplier Cost</span>
                <span className="font-semibold text-red-600">{currSymbol(preview.totals.currency)}{preview.totals.acquiringCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Margin</span>
                <span className="font-semibold text-blue-600">{preview.totals.marginPct.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <div>
                  <div className="text-lg font-bold text-slate-900">Client Price</div>
                  <div className="text-xs text-slate-400">{numParticipants} pax × {currSymbol(preview.tier.currency)}{preview.tier.price_per_person}/person{selectedExtraKeys.length > 0 ? ' + extras' : ''}</div>
                </div>
                <div className="text-3xl font-bold text-green-700">{currSymbol(preview.totals.currency)}{preview.totals.sellingPrice.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {createMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create Reservation'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
