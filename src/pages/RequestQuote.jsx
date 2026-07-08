import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SendHorizontal, CheckCircle2, Plane } from 'lucide-react';
import LocationSearch from '@/components/services/LocationSearch';
import { useT } from '@/lib/i18n/I18nContext';

export default function RequestQuote() {
  const { t } = useT();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    destination: '',
    start_date: '',
    end_date: '',
    travelers: 1,
    budget: '',
    description: '',
    referral: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const lead = {
        type: 'lead',
        name: form.name,
        email: form.email,
        phone: form.phone,
        source: 'web_quote_request',
        notes: `Destination: ${form.destination}\nDates: ${form.start_date} to ${form.end_date}\nTravelers: ${form.travelers}\nBudget: ${form.budget}\nDescription: ${form.description}\nReferral: ${form.referral}`,
        status: 'potential_deal',
        created_date: new Date().toISOString(),
      };
      await db.entities.Client.create(lead);
      setSubmitted(true);
    } catch {
      alert(t('requestQuote.errorGeneric'));
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 dark:from-blue-950/40 to-indigo-50 dark:to-indigo-950/40 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center bg-card shadow-xl">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-300" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('requestQuote.thankYouTitle')}</h1>
          <p className="text-muted-foreground mb-4">{t('requestQuote.thankYouBody')}</p>
          <p className="text-sm text-muted-foreground">
            {t('requestQuote.reference', { name: form.name, destination: form.destination })}
          </p>
          <Button className="mt-6" onClick={() => setSubmitted(false)}>
            {t('requestQuote.submitAnother')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 dark:from-blue-950/40 via-card to-indigo-50 dark:to-indigo-950/40">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
            <Plane className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">{t('clientPortal.requestQuote')}</h1>
          <p className="text-muted-foreground mt-2">{t('requestQuote.subtitle')}</p>
        </div>

        <Card className="p-6 bg-card shadow-lg border-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">{t('requestQuote.nameLabel')}</label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t('requestQuote.namePlaceholder')}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">{t('requestQuote.emailLabel')}</label>
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={t('requestQuote.emailPlaceholder')}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">{t('requestQuote.phoneLabel')}</label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder={t('requestQuote.phonePlaceholder')}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">{t('requestQuote.destinationLabel')}</label>
                <LocationSearch
                  value={form.destination}
                  onChange={(v) => setForm({ ...form, destination: v })}
                  placeholder={t('requestQuote.destinationPlaceholder')}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">{t('requestQuote.startDateLabel')}</label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">{t('requestQuote.endDateLabel')}</label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">{t('requestQuote.travelersLabel')}</label>
                <Input
                  type="number"
                  min={1}
                  value={form.travelers}
                  onChange={(e) => setForm({ ...form, travelers: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">{t('requestQuote.budgetLabel')}</label>
                <Select value={form.budget} onValueChange={(v) => setForm({ ...form, budget: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('requestQuote.budgetPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="under_1000">{t('requestQuote.budgetUnder1000')}</SelectItem>
                    <SelectItem value="1000_3000">{t('requestQuote.budget1000to3000')}</SelectItem>
                    <SelectItem value="3000_5000">{t('requestQuote.budget3000to5000')}</SelectItem>
                    <SelectItem value="5000_10000">{t('requestQuote.budget5000to10000')}</SelectItem>
                    <SelectItem value="over_10000">{t('requestQuote.budgetOver10000')}</SelectItem>
                    <SelectItem value="not_sure">{t('requestQuote.budgetNotSure')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">{t('requestQuote.referralLabel')}</label>
                <Select value={form.referral} onValueChange={(v) => setForm({ ...form, referral: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('requestQuote.referralPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">{t('requestQuote.referralGoogle')}</SelectItem>
                    <SelectItem value="social">{t('requestQuote.referralSocial')}</SelectItem>
                    <SelectItem value="referral">{t('requestQuote.referralFriend')}</SelectItem>
                    <SelectItem value="repeat">{t('requestQuote.referralReturning')}</SelectItem>
                    <SelectItem value="other">{t('requestQuote.referralOther')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">{t('requestQuote.descriptionLabel')}</label>
              <Textarea
                required
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('requestQuote.descriptionPlaceholder')}
              />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base">
              <SendHorizontal className="w-5 h-5 mr-2" />
              {t('requestQuote.sendRequest')}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
