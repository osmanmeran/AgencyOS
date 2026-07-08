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
import { useT } from '@/lib/i18n/I18nContext';

export default function CreateClient() {
  const { t } = useT();
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
    portal_access: false,
  });

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.Client.create(data),
      onSuccess: (/** @type {any} */ newClient) => {
        showSuccess(t('createClient.successMsg'));
        queryClient.invalidateQueries({ queryKey: ['clients'] });
        navigate(createPageUrl(`ClientDetails?id=${newClient.id}`));
      },
      onError: (error) => showError(t('createClient.errorMsg'), error.message),
    })
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <Link to={createPageUrl('ClientCRM')}>
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          {t('clientCRM.backToClients')}
        </Button>
      </Link>

      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">{t('createClient.title')}</h1>
        <p className="text-muted-foreground">{t('createClient.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 bg-card shadow-md">
          <h2 className="text-xl font-bold text-foreground mb-4">{t('createClient.basicInfo')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('crm.fullName')} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="age_category">{t('createClient.ageCategory')}</Label>
              <Select
                value={formData.age_category}
                onValueChange={(v) => setFormData({ ...formData, age_category: v })}
              >
                <SelectTrigger id="age_category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adult">{t('passengers.adult')}</SelectItem>
                  <SelectItem value="children">{t('passengers.children')}</SelectItem>
                  <SelectItem value="infant">{t('passengers.infant')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t('createClient.primaryContact')}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={t('createClient.contactPlaceholder')}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_secondary">{t('createClient.secondaryContact')}</Label>
              <Input
                id="phone_secondary"
                type="tel"
                placeholder={t('createClient.contactPlaceholder')}
                value={formData.phone_secondary}
                onChange={(e) => setFormData({ ...formData, phone_secondary: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('common.email')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">{t('crm.company')}</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">{t('crm.dateOfBirth')}</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passport_number">{t('crm.passportNumber')}</Label>
              <Input
                id="passport_number"
                value={formData.passport_number}
                onChange={(e) => setFormData({ ...formData, passport_number: e.target.value })}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card shadow-md">
          <h2 className="text-xl font-bold text-foreground mb-4">{t('createClient.addressDetails')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="address">{t('common.address')}</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">{t('common.city')}</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">{t('common.country')}</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card shadow-md">
          <h2 className="text-xl font-bold text-foreground mb-4">{t('createClient.billingInfo')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="invoice_address">{t('createClient.invoiceAddress')}</Label>
              <Textarea
                id="invoice_address"
                value={formData.invoice_address}
                onChange={(e) => setFormData({ ...formData, invoice_address: e.target.value })}
                rows={2}
                placeholder={t('createClient.invoiceAddressPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_id">{t('createClient.taxIdVat')}</Label>
              <Input
                id="tax_id"
                value={formData.tax_id}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_method">{t('createClient.preferredPaymentMethod')}</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(v) => setFormData({ ...formData, payment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">{t('createClient.paymentCreditCard')}</SelectItem>
                  <SelectItem value="bank_transfer">{t('createClient.paymentBankTransfer')}</SelectItem>
                  <SelectItem value="paypal">{t('createClient.paymentPaypal')}</SelectItem>
                  <SelectItem value="check">{t('createClient.paymentCheck')}</SelectItem>
                  <SelectItem value="cash">{t('createClient.paymentCash')}</SelectItem>
                  <SelectItem value="other">{t('createClient.paymentOther')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card shadow-md">
          <h2 className="text-xl font-bold text-foreground mb-4">{t('createClient.clientSettings')}</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">{t('common.status')}</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('common.active')}</SelectItem>
                  <SelectItem value="inactive">{t('common.inactive')}</SelectItem>
                  <SelectItem value="vip">{t('clientCRM.vip')}</SelectItem>
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
                {t('crm.portalAccess')}
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('crm.internalNotes')}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder={t('createClient.notesPlaceholder')}
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Link to={createPageUrl('ClientCRM')}>
            <Button type="button" variant="outline">
              {t('common.cancel')}
            </Button>
          </Link>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={createMutation.isPending}>
            {createMutation.isPending ? t('createClient.creating') : t('crm.createClient')}
          </Button>
        </div>
      </form>
    </div>
  );
}
