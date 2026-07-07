import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useT } from '../../lib/i18n/I18nContext';
import CompanyPicker from './CompanyPicker';
import LocationSearch from '@/components/services/LocationSearch';

const PAYMENT_METHODS = ['credit_card', 'bank_transfer', 'paypal', 'check', 'cash', 'other'];

export default function NewClientForm({ onCreated, onCancel }) {
  const { t } = useT();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    company_id: '',
    address: '',
    city: '',
    country: '',
    passport_number: '',
    date_of_birth: '',
    tax_id: '',
    payment_method: 'credit_card',
    status: 'active',
    portal_access: false,
    notes: '',
  });

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.Client.create(data),
      onSuccess: (newClient) => onCreated(newClient),
    })
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-8">
      {/* Personal Details */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          {t('crm.personalDetails')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>{t('crm.fullName')} *</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Jane Doe" required />
          </div>
          <div className="space-y-1">
            <Label>{t('common.email')} *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="jane@example.com"
              required
            />
          </div>
          <div className="space-y-1">
            <Label>{t('common.phone')}</Label>
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+1 555 000 000" />
          </div>
          <div className="space-y-1">
            <Label>{t('crm.dateOfBirth')}</Label>
            <Input type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{t('crm.passportNumber')}</Label>
            <Input
              value={form.passport_number}
              onChange={(e) => set('passport_number', e.target.value)}
              placeholder="AB1234567"
            />
          </div>
          <div className="space-y-1">
            <Label>{t('common.status')}</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Company & Address */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          {t('crm.companyAddress')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>{t('crm.company')}</Label>
            <CompanyPicker
              value={form.company_id}
              companyName={form.company}
              onChange={({ company_id, company }) => setForm((prev) => ({ ...prev, company_id, company }))}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('crm.taxId')}</Label>
            <Input value={form.tax_id} onChange={(e) => set('tax_id', e.target.value)} placeholder="VAT12345" />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label>{t('common.address')}</Label>
            <LocationSearch
              value={form.address}
              onChange={(v) => set('address', v)}
              onSelect={(item) =>
                setForm((prev) => ({
                  ...prev,
                  address: item.label,
                  city: prev.city || item.city,
                  country: prev.country || item.country,
                }))
              }
              placeholder="Search address (OpenStreetMap)..."
            />
          </div>
          <div className="space-y-1">
            <Label>{t('common.city')}</Label>
            <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="London" />
          </div>
          <div className="space-y-1">
            <Label>{t('common.country')}</Label>
            <Input value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="United Kingdom" />
          </div>
        </div>
      </section>

      {/* Preferences */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          {t('crm.preferences')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>{t('crm.paymentMethod')}</Label>
            <Select value={form.payment_method} onValueChange={(v) => set('payment_method', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={form.portal_access} onCheckedChange={(v) => set('portal_access', v)} id="portal_access" />
            <Label htmlFor="portal_access" className="cursor-pointer">
              {t('crm.portalAccess')}
            </Label>
          </div>
        </div>
        <div className="mt-4 space-y-1">
          <Label>{t('crm.internalNotes')}</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Special preferences, allergies, VIP notes..."
            rows={3}
          />
        </div>
      </section>

      <div className="flex justify-end gap-3 pt-2 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={createMutation.isPending}>
          {createMutation.isPending ? t('common.saving') : t('crm.createClient')}
        </Button>
      </div>
    </form>
  );
}
