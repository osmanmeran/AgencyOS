const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageSquare, Calendar, Users, DollarSign, Send, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  quoted: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-slate-100 text-slate-800'
};

export default function SupplierQuoteRequests({ supplierId }) {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [quoteForm, setQuoteForm] = useState({
    quoted_price: '',
    valid_until: '',
    response_notes: ''
  });

  // Fetch quote requests for this supplier
  const { data: quoteRequests = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['supplierQuoteRequests', supplierId],
    queryFn: async () => {
      // Using BookingRequest with a special flag or filtering by those without confirmed status
      const requests = await db.entities.BookingRequest.filter({ 
        supplier_id: supplierId,
        status: 'pending'
      }, '-created_date');
      return requests;
    },
    enabled: !!supplierId
  }));

  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['trips'],
    queryFn: () => db.entities.Trip.list()
  }));

  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['clients'],
    queryFn: () => db.entities.Client.list()
  }));

  const respondMutation = /** @type {any} */ (useMutation({
    mutationFn: async (/** @type {any} */ { id, /** @type {any} */ data, /** @type {any} */ action }) => {
      const updateData = {
        status: action === 'quote' ? 'quoted' : 'rejected',
        total_cost: action === 'quote' ? parseFloat(data.quoted_price) : undefined,
        supplier_notes: data.response_notes,
        quote_valid_until: data.valid_until
      };
      return db.entities.BookingRequest.update(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplierQuoteRequests', supplierId] });
      setSelectedRequest(null);
      setQuoteForm({ quoted_price: '', valid_until: '', response_notes: '' });
    }
  }));

  const getTrip = (id) => trips.find(t => t.id === id);
  const getClient = (id) => clients.find(c => c.id === id);

  const openQuoteModal = (request) => {
    setSelectedRequest(request);
    setQuoteForm({
      quoted_price: request.total_cost?.toString() || '',
      valid_until: '',
      response_notes: ''
    });
  };

  return (
    <div className="space-y-4">
      {quoteRequests.length === 0 ? (
        <Card className="p-12 text-center">
          <MessageSquare className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No quote requests</h3>
          <p className="text-slate-600">Custom quote requests from clients will appear here</p>
        </Card>
      ) : (
        quoteRequests.map(request => {
          const trip = getTrip(request.trip_id);
          const client = getClient(request.client_id);
          return (
            <Card key={request.id} className="p-6 bg-white">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-slate-900">
                      Quote Request #{request.id.slice(-6)}
                    </h3>
                    <Badge className={STATUS_COLORS[request.status] || STATUS_COLORS.pending}>
                      {request.status}
                    </Badge>
                  </div>
                  <p className="text-slate-600 text-sm">{trip?.name || 'Custom Request'}</p>
                  {client && <p className="text-slate-500 text-xs">Client: {client.name}</p>}
                </div>
                <Button onClick={() => openQuoteModal(request)} className="bg-blue-600 hover:bg-blue-700">
                  <Send className="w-4 h-4 mr-2" /> Respond
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>{format(new Date(request.service_date), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>{request.num_guests} guests</span>
                </div>
                {request.total_cost > 0 && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    <span>Budget: ${request.total_cost.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Received: {format(new Date(request.created_date), 'MMM d')}</span>
                </div>
              </div>

              {request.service_details && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <Label className="text-xs text-slate-500">Request Details:</Label>
                  <p className="text-sm text-slate-700 mt-1">{request.service_details}</p>
                </div>
              )}
            </Card>
          );
        })
      )}

      {/* Quote Response Modal */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to Quote Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {selectedRequest && (
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="text-sm text-slate-600 mb-2">
                  <strong>Service Date:</strong> {format(new Date(selectedRequest.service_date), 'MMM d, yyyy')}
                </div>
                <div className="text-sm text-slate-600 mb-2">
                  <strong>Guests:</strong> {selectedRequest.num_guests}
                </div>
                {selectedRequest.service_details && (
                  <div className="text-sm text-slate-600">
                    <strong>Details:</strong> {selectedRequest.service_details}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Your Quote Price *</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={quoteForm.quoted_price}
                onChange={(e) => setQuoteForm({ ...quoteForm, quoted_price: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Quote Valid Until</Label>
              <Input 
                type="date" 
                value={quoteForm.valid_until}
                onChange={(e) => setQuoteForm({ ...quoteForm, valid_until: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Response Notes</Label>
              <Textarea 
                value={quoteForm.response_notes}
                onChange={(e) => setQuoteForm({ ...quoteForm, response_notes: e.target.value })}
                placeholder="Additional details about your quote..."
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={() => respondMutation.mutate({ id: selectedRequest.id, data: quoteForm, action: 'quote' })}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={!quoteForm.quoted_price}
              >
                <CheckCircle className="w-4 h-4 mr-2" /> Send Quote
              </Button>
              <Button 
                onClick={() => respondMutation.mutate({ id: selectedRequest.id, data: quoteForm, action: 'decline' })}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className="w-4 h-4 mr-2" /> Decline
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}