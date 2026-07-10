import { db } from '@/lib/DbContext';
import { getCurrencySymbol } from '@/lib/formatters';

import { useState, useMemo, useEffect } from 'react';
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
import { buildTripFromContract, emptyPassenger } from '@/lib/contractBooking';
import PassengerFieldsRow from '../components/passengers/PassengerFieldsRow';
import { useT } from '@/lib/i18n/I18nContext';

const currSymbol = (cur) => getCurrencySymbol(cur);

export default function GenerateFromContract() {
  const { t } = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [contractId, setContractId] = useState(searchParams.get('contract_id') || '');
  const [departureDate, setDepartureDate] = useState('');
  const [numParticipants, setNumParticipants] = useState(2);
  const [selectedExtraKeys, setSelectedExtraKeys] = useState(/** @type {string[]} */ ([]));
  const [passengers, setPassengers] = useState(() => [emptyPassenger(0), emptyPassenger(1)]);

  // Keep passenger rows in sync with the participant count — growing adds
  // blank rows, shrinking drops the trailing ones, existing entries are
  // preserved either way. Fields stay optional (see PassengerFieldsRow).
  useEffect(() => {
    setPassengers((prev) => {
      const n = Math.max(0, numParticipants || 0);
      if (prev.length === n) return prev;
      if (prev.length < n) {
        const additions = Array.from({ length: n - prev.length }, (_, i) => emptyPassenger(prev.length + i));
        return [...prev, ...additions];
      }
      return prev.slice(0, n);
    });
  }, [numParticipants]);

  const updatePassenger = (paxId, updated) => setPassengers((prev) => prev.map((p) => (p.id === paxId ? updated : p)));
  const setContactPassenger = (paxId) =>
    setPassengers((prev) => prev.map((p) => ({ ...p, is_contact: p.id === paxId })));

  const { data: contracts = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['TourContract'],
      queryFn: () => db.entities.TourContract.list(),
    })
  );
  const activeContracts = contracts.filter((c) => c.is_active !== false);
  const contract = contracts.find((c) => c.id === contractId) || null;

  const { data: client } = /** @type {any} */ (
    useQuery({
      queryKey: ['client', contract?.client_id],
      queryFn: () => db.entities.Client.get(contract.client_id),
      enabled: !!contract?.client_id,
    })
  );

  const { data: settings } = /** @type {any} */ (
    useQuery({
      queryKey: ['appSettings'],
      queryFn: async () => {
        const all = await db.entities.AppSettings.list();
        return all[0] || {};
      },
    })
  );
  const { data: currentUser } = /** @type {any} */ (useQuery({ queryKey: ['me'], queryFn: () => db.auth.me() }));

  const preview = useMemo(() => {
    if (!contract || !client || !departureDate || !numParticipants) return null;
    return buildTripFromContract({ contract, client, departureDate, numParticipants, selectedExtraKeys, passengers });
  }, [contract, client, departureDate, numParticipants, selectedExtraKeys, passengers]);

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.Trip.create(data),
      onSuccess: (/** @type {any} */ created) => {
        showSuccess('Reservation created from contract');
        queryClient.invalidateQueries({ queryKey: ['trips'] });
        navigate(createPageUrl(`ReservationDetails?id=${created.id}`));
      },
      onError: (error) => showError('Failed to create reservation', error.message),
    })
  );

  const toggleExtra = (key) =>
    setSelectedExtraKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

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
      change_history: [
        {
          date: new Date().toISOString(),
          changed_by: currentUser?.email || 'unknown',
          changed_by_name: currentUser?.name || currentUser?.email || 'Unknown',
          action: 'created',
          description: `Reservation generated from contract "${contract.name}"`,
        },
      ],
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link to={createPageUrl('TourContracts')}>
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Tour Contracts
        </Button>
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-foreground">Generate Booking from Contract</h1>
        <p className="text-muted-foreground mt-1">
          Pick a contract, a departure date and the number of participants — the itinerary and pricing fill in
          automatically
        </p>
      </div>

      <Card className="p-6 bg-card shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Tour Contract *</Label>
            <Select value={contractId} onValueChange={setContractId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a contract..." />
              </SelectTrigger>
              <SelectContent>
                {activeContracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {contract && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Client</Label>
                <p className="text-sm font-medium text-foreground">{contract.client_name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Destination</Label>
                <p className="text-sm font-medium text-foreground">{contract.destination || '—'}</p>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Departure Date *
            </Label>
            <Input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Participants *
            </Label>
            <Input
              type="number"
              min="1"
              value={numParticipants}
              onChange={(e) => setNumParticipants(parseInt(e.target.value) || 0)}
              required
            />
          </div>
        </div>

        {client?.fixed_extras?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <Label className="text-sm font-semibold text-foreground mb-2 block">
              Optional Extras for {client.name}
            </Label>
            <div className="space-y-2">
              {client.fixed_extras.map((extra) => (
                <label key={extra._key} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted">
                  <Checkbox
                    checked={selectedExtraKeys.includes(extra._key)}
                    onCheckedChange={() => toggleExtra(extra._key)}
                  />
                  <span className="text-sm text-foreground">{extra.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {currSymbol(extra.currency)}
                    {extra.selling_price}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </Card>

      {numParticipants > 0 && (
        <Card className="p-6 bg-card shadow-md">
          <h2 className="text-lg font-bold text-foreground mb-1">{t('passengers.title')}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t('passengers.optionalHint')}</p>
          <div className="space-y-3">
            {passengers.map((pax) => (
              <PassengerFieldsRow
                key={pax.id}
                passenger={pax}
                onChange={(updated) => updatePassenger(pax.id, updated)}
                showContact
                onSetContact={() => setContactPassenger(pax.id)}
              />
            ))}
          </div>
        </Card>
      )}

      {contract && departureDate && numParticipants > 0 && preview?.missingTier && (
        <Card className="p-6 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-300 mt-0.5" />
            <div>
              {preview.isGroupMissingPrice ? (
                <>
                  <p className="font-semibold text-amber-800 dark:text-amber-300">
                    No group price set for this contract
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    This is a group tour but has no group price configured. Set a group price in the contract before
                    generating a booking.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-amber-800 dark:text-amber-300">
                    No pricing tier for {numParticipants} participants
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    {preview.availablePax.length > 0
                      ? `This contract has pricing for: ${preview.availablePax.join(', ')} participants. Add a tier for ${numParticipants} in the contract, or adjust the participant count.`
                      : 'This contract has no pricing tiers configured yet. Add pricing tiers in the contract before generating a booking.'}
                  </p>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      {preview?.ok && (
        <Card className="p-6 bg-card shadow-md">
          <h2 className="text-lg font-bold text-foreground mb-4">Preview</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Service</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Dates</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.services.map((s) => (
                  <tr key={s._key}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{s.name || s.category}</div>
                      <div className="text-xs text-muted-foreground">{s.category}</div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {s.start_date}
                      {s.end_date && s.end_date !== s.start_date ? ` → ${s.end_date}` : ''}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {s.quantity} {s.unit?.replace('per_', '/')}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">
                      {currSymbol(s.supplier_currency)}
                      {((Number(s.acquiring_price) || 0) * (Number(s.quantity) || 1)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 pt-4 border-t border-border flex justify-end">
            <div className="w-80 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Supplier Cost</span>
                <span className="font-semibold text-red-600 dark:text-red-300">
                  {currSymbol(preview.totals.currency)}
                  {preview.totals.acquiringCost.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Margin</span>
                <span className="font-semibold text-blue-600 dark:text-blue-300">
                  {preview.totals.marginPct.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <div>
                  <div className="text-lg font-bold text-foreground">Client Price</div>
                  <div className="text-xs text-muted-foreground">
                    {numParticipants} pax × {currSymbol(preview.tier.currency)}
                    {preview.tier.price_per_person}/person{selectedExtraKeys.length > 0 ? ' + extras' : ''}
                  </div>
                </div>
                <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                  {currSymbol(preview.totals.currency)}
                  {preview.totals.sellingPrice.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Reservation'
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
