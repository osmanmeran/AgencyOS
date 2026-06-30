const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useExport } from '@/hooks/useExport';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { SkeletonTable } from '@/components/ui/skeletons';
import { Plus, UserCircle, Search, Mail, Phone, Building, ArrowRight, Star, XCircle, CheckSquare, Download } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  vip: 'bg-purple-100 text-purple-800'
};

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
  const [isBulkCancelling, setIsBulkCancelling] = useState(false);
  const queryClient = useQueryClient();
  const { exportCSV } = useExport();

  const { data: clients = /** @type {any} */ ([]), isLoading } = /** @type {any} */ (useQuery({
    queryKey: ['clients'],
    queryFn: () => db.entities.Client.list('-created_date')
  }));

  const filteredClients = clients.filter(client =>
    client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelect = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredClients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredClients.map(c => c.id)));
    }
  };

  const handleBulkCancel = async () => {
    setIsBulkCancelling(true);
    try {
      await Promise.all(
        [...selectedIds].map(id => db.entities.Client.delete(id))
      );
      showSuccess('Clients deleted');
      setSelectedIds(new Set());
      setBulkCancelOpen(false);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (error) {
      showError('Failed to delete clients', error.message);
    }
    setIsBulkCancelling(false);
  };

  if (isLoading) {
    return <SkeletonTable />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Clients</h1>
          <p className="text-slate-600">Manage your client database and relationships</p>
        </div>
        <Button variant="outline" onClick={() => exportCSV(filteredClients, 'clients', [
          { label: 'Name', accessor: (c) => c.name },
          { label: 'Email', accessor: (c) => c.email },
          { label: 'Phone', accessor: (c) => c.phone },
          { label: 'Company', accessor: (c) => c.company },
          { label: 'City', accessor: (c) => c.city },
          { label: 'Status', accessor: (c) => c.status },
          { label: 'Total Paid', accessor: (c) => c.total_paid },
          { label: 'Total Owed', accessor: (c) => c.total_owed }
        ])}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
        <Link to={createPageUrl('CreateClient')}>
          <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg">
            <Plus className="w-5 h-5 mr-2" />
            New Client
          </Button>
        </Link>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-5 py-3">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-800">{selectedIds.size} client{selectedIds.size > 1 ? 's' : ''} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
              Deselect All
            </Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setBulkCancelOpen(true)}>
              <XCircle className="w-4 h-4 mr-2" />
              Cancel {selectedIds.size} Client{selectedIds.size > 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}

      {/* Search and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-2 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder="Search clients by name, email, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="text-sm opacity-90 mb-1">Total Clients</div>
          <div className="text-3xl font-bold">{clients.length}</div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="text-sm opacity-90 mb-1">VIP Clients</div>
          <div className="text-3xl font-bold">{clients.filter(c => c.status === 'vip').length}</div>
        </Card>
      </div>

      {/* Clients Grid */}
      {filteredClients.length === 0 ? (
        <Card className="p-12 text-center bg-white shadow-md">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCircle className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            {searchTerm ? 'No clients found' : 'No clients yet'}
          </h3>
          <p className="text-slate-600 mb-6">
            {searchTerm ? 'Try adjusting your search' : 'Start building your client database'}
          </p>
          {!searchTerm && (
            <Link to={createPageUrl('CreateClient')}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add First Client
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <>
        <div className="flex items-center gap-2 mb-2">
          <Button variant="outline" size="sm" onClick={toggleSelectAll}>
            {selectedIds.size === filteredClients.length && filteredClients.length > 0 ? 'Deselect All' : 'Select All'}
          </Button>
          <span className="text-sm text-slate-500">{filteredClients.length} clients</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map(client => (
            <div key={client.id} className="relative">
              <div
                className="absolute top-4 left-4 z-10"
                onClick={(e) => toggleSelect(client.id, e)}
              >
                <Checkbox checked={selectedIds.has(client.id)} />
              </div>
              <Link to={createPageUrl(`ClientDetails?id=${client.id}`)}>
              <Card className={`p-6 bg-white hover:shadow-xl transition-all cursor-pointer group ${selectedIds.has(client.id) ? 'ring-2 ring-blue-500' : ''}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3 pl-7">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <UserCircle className="w-7 h-7 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                        {client.name}
                        {client.status === 'vip' && <Star className="w-4 h-4 text-purple-600 fill-purple-600" />}
                      </h3>
                      {client.company && (
                        <p className="text-sm text-slate-600">{client.company}</p>
                      )}
                    </div>
                  </div>
                  <Badge className={STATUS_COLORS[client.status]}>
                    {client.status}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  {client.email && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-4 h-4" />
                      {client.phone}
                    </div>
                  )}
                  {client.city && client.country && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Building className="w-4 h-4" />
                      {client.city}, {client.country}
                    </div>
                  )}
                </div>

                {(client.total_paid > 0 || client.total_owed > 0) && (
                  <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-slate-500">Total Paid</div>
                      <div className="font-bold text-green-700">${(client.total_paid || 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Owed</div>
                      <div className="font-bold text-orange-700">${(client.total_owed || 0).toFixed(2)}</div>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-end text-blue-600 text-sm font-medium group-hover:gap-2 gap-1 transition-all">
                  View Details
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Card>
              </Link>
            </div>
          ))}
        </div>
        </>
      )}

      <AlertDialog open={bulkCancelOpen} onOpenChange={setBulkCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete {selectedIds.size} Client{selectedIds.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>permanently delete</strong> all selected clients from the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkCancelling}>Keep Clients</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkCancel}
              disabled={isBulkCancelling}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isBulkCancelling ? 'Cancelling...' : `Yes, Cancel ${selectedIds.size} Client${selectedIds.size > 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}