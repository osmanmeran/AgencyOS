import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toast';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function CreateClient() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    phone_secondary: '',
    age_category: 'adult',
    company: '',
    address: '',
    city: '',
    country: '',
    passport_number: '',
    date_of_birth: '',
    invoice_address: '',
    tax_id: '',
    payment_method: 'credit_card',
    notes: '',
    status: 'active',
    portal_access: false
  });

  const createMutation = /** @type {any} */ (useMutation({
    mutationFn: (/** @type {any} */ data) => db.entities.Client.create(data),
    onSuccess: (/** @type {any} */ newClient) => {
      showSuccess('Client created');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      navigate(createPageUrl(`ClientDetails?id=${newClient.id}`));
    },
    onError: (error) => showError('Failed to create client', error.message)
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <Link to={createPageUrl('Clients')}>
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </Button>
      </Link>

      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Add New Client</h1>
        <p className="text-slate-600">Create a new client profile</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 bg-white shadow-md">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="age_category">Age Category *</Label>
              <Select value={formData.age_category} onValueChange={(v) => setFormData({ ...formData, age_category: v })}>
                <SelectTrigger id="age_category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adult">Adult</SelectItem>
                  <SelectItem value="children">Children (3 – 11.99 anni)</SelectItem>
                  <SelectItem value="infant">Infant (0 – 2.99 anni)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Contatto Principale *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+39 000 000 0000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_secondary">Contatto Secondario</Label>
              <Input
                id="phone_secondary"
                type="tel"
                placeholder="+39 000 000 0000"
                value={formData.phone_secondary}
                onChange={(e) => setFormData({ ...formData, phone_secondary: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passport_number">Passport Number</Label>
              <Input
                id="passport_number"
                value={formData.passport_number}
                onChange={(e) => setFormData({ ...formData, passport_number: e.target.value })}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white shadow-md">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Address Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white shadow-md">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Billing Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="invoice_address">Invoice Address</Label>
              <Textarea
                id="invoice_address"
                value={formData.invoice_address}
                onChange={(e) => setFormData({ ...formData, invoice_address: e.target.value })}
                rows={2}
                placeholder="If different from main address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_id">Tax ID / VAT Number</Label>
              <Input
                id="tax_id"
                value={formData.tax_id}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_method">Preferred Payment Method</Label>
              <Select value={formData.payment_method} onValueChange={(v) => setFormData({ ...formData, payment_method: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white shadow-md">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Client Settings</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="portal_access"
                checked={formData.portal_access}
                onCheckedChange={(checked) => setFormData({ ...formData, portal_access: checked })}
              />
              <Label htmlFor="portal_access" className="cursor-pointer">
                Grant client portal access
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Internal Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Internal notes about this client..."
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Link to={createPageUrl('Clients')}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Client'}
          </Button>
        </div>
      </form>
    </div>
  );
}