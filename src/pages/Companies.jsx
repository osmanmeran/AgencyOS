import { db } from '@/lib/DbContext';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Plus, Search, Users, Globe, MapPin, ArrowLeft } from 'lucide-react';

export default function Companies() {
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const queryClient = useQueryClient();

  const { data: companies = /** @type {any} */ ([]), isLoading } = /** @type {any} */ (useQuery({
    queryKey: ['companies'],
    queryFn: () => db.entities.Company.list('name')
  }));

  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['clients'],
    queryFn: () => db.entities.Client.list('-created_date')
  }));

  const countByCompany = useMemo(() => {
    const map = {};
    for (const c of clients) {
      if (c.company_id) map[c.company_id] = (map[c.company_id] || 0) + 1;
    }
    return map;
  }, [clients]);

  const filtered = useMemo(() => {
    if (!search) return companies;
    const q = search.toLowerCase();
    return companies.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.country?.toLowerCase().includes(q) ||
      c.industry?.toLowerCase().includes(q)
    );
  }, [companies, search]);

  const createMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ name) => db.entities.Company.create({ name, status: 'active' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setShowNew(false);
      setNewName('');
    }
  }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-2.5 rounded-xl shadow-md">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
            <p className="text-sm text-slate-500">{companies.length} companies</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={createPageUrl('ClientCRM')}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Contacts
            </Button>
          </Link>
          <Button onClick={() => setShowNew(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />New Company
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          placeholder="Search companies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 text-sm h-9"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5">
              <Skeleton className="h-10 w-10 rounded-xl mb-3" />
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center">
          <Building2 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">{search ? 'No companies match your search.' : 'No companies yet. Create one to group your contacts.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(company => (
            <Link key={company.id} to={createPageUrl(`CompanyDetails?id=${company.id}`)}>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all h-full">
                <div className="flex items-start gap-3 mb-3">
                  {company.logo_url ? (
                    <img src={company.logo_url} alt={company.name} className="w-11 h-11 rounded-xl object-cover border border-slate-100 flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0">
                      {(company.name || '?').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 truncate">{company.name}</div>
                    {company.industry && <div className="text-xs text-slate-400 truncate">{company.industry}</div>}
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    {countByCompany[company.id] || 0} contact{(countByCompany[company.id] || 0) === 1 ? '' : 's'}
                  </div>
                  {(company.city || company.country) && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{[company.city, company.country].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {company.website && (
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{company.website.replace(/^https?:\/\//, '')}</span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* New company dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Company name</Label>
            <Input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Acme Corp"
              onKeyDown={e => e.key === 'Enter' && newName.trim() && createMutation.mutate(newName.trim())}
            />
            <p className="text-xs text-slate-400">You can add address, logo and billing details after creating it.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate(newName.trim())}
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
