import { db } from '@/lib/DbContext';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { SkeletonTable } from '@/components/ui/skeletons';
import { Plus, Search, Edit, Trash2, FileText, Zap } from 'lucide-react';
import { createPageUrl } from '../utils';
import { usePermissions } from '../components/permissions/PermissionContext';
import { showSuccess, showError } from '@/lib/toast';

export default function TourContracts() {
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('manage_tour_contracts');

  const { data: contracts = /** @type {any} */ ([]), isLoading } = /** @type {any} */ (useQuery({
    queryKey: ['TourContract'],
    queryFn: () => db.entities.TourContract.list(),
  }));

  const deleteMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ id) => db.entities.TourContract.delete(id),
    onSuccess: () => { showSuccess('Contract deleted'); queryClient.invalidateQueries({ queryKey: ['TourContract'] }); setDeleteTarget(null); },
    onError: (error) => showError('Failed to delete contract', error.message),
  }));

  const filtered = useMemo(() => {
    if (!search.trim()) return contracts;
    const q = search.toLowerCase();
    return contracts.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.client_name?.toLowerCase().includes(q) ||
      c.destination?.toLowerCase().includes(q)
    );
  }, [contracts, search]);

  if (isLoading) return <SkeletonTable />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Tour Contracts</h1>
          <p className="text-slate-600">Recurring serial tours with a fixed itinerary and pax-based pricing</p>
        </div>
        {canManage && (
          <Link to={createPageUrl('TourContractForm')}>
            <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg">
              <Plus className="w-5 h-5 mr-2" />New Contract
            </Button>
          </Link>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <Input
          placeholder="Search by name, client or destination..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-white"
        />
      </div>

      <Card className="bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Destination</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Itinerary</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Pricing Tiers</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-500">
                    {search ? 'No contracts match your search.' : 'No tour contracts yet. Create your first one!'}
                  </td>
                </tr>
              ) : (
                filtered.map(contract => (
                  <tr key={contract.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{contract.name}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{contract.client_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{contract.destination || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 text-sm">
                      <span className="inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{(contract.itinerary || []).length} line{(contract.itinerary || []).length !== 1 ? 's' : ''}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{(contract.pricing_tiers || []).length} tier{(contract.pricing_tiers || []).length !== 1 ? 's' : ''}</td>
                    <td className="px-4 py-3">
                      <Badge className={contract.is_active !== false ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}>
                        {contract.is_active !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {contract.is_active !== false && (
                          <Link to={createPageUrl(`GenerateFromContract?contract_id=${contract.id}`)}>
                            <Button variant="ghost" size="icon" title="Generate booking">
                              <Zap className="w-4 h-4 text-blue-500" />
                            </Button>
                          </Link>
                        )}
                        {canManage && (
                          <>
                            <Link to={createPageUrl(`TourContractForm?id=${contract.id}`)}>
                              <Button variant="ghost" size="icon" title="Edit contract">
                                <Edit className="w-4 h-4 text-slate-500" />
                              </Button>
                            </Link>
                            <Button variant="ghost" size="icon" title="Delete contract" onClick={() => setDeleteTarget(contract)}>
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
          {filtered.length} of {contracts.length} contract{contracts.length !== 1 ? 's' : ''}
        </div>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the contract. Bookings already generated from it are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Contract'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
