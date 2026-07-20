import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRightLeft, RefreshCw } from 'lucide-react';
import { CURRENCIES } from './helpers';
import { useT } from '@/lib/i18n/I18nContext';

export default function CurrencySettingsCard({
  acquiringCurrency,
  setAcquiringCurrency,
  sellingCurrency,
  setSellingCurrency,
  exchangeRate,
  setExchangeRate,
  fetchExchangeRate,
  loadingRate,
}) {
  const { t: _t } = useT();
  return (
    <Card className="p-5 bg-card shadow-md border-l-4 border-blue-500">
      <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
        <ArrowRightLeft className="w-4 h-4 text-blue-600 dark:text-blue-300" />
        {_t('createReservation.currency')}
      </h2>
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>
            {_t('createReservation.acquiring')}{' '}
            <span className="text-red-500 dark:text-red-300 text-xs">{_t('createReservation.what')}</span>
          </Label>
          <Select
            value={acquiringCurrency}
            onValueChange={(v) => {
              setAcquiringCurrency(v);
              setExchangeRate(1);
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ArrowRightLeft className="w-5 h-5 text-muted-foreground mb-1" />
        <div className="space-y-2">
          <Label>
            {_t('createReservation.selling_2')}{' '}
            <span className="text-green-600 dark:text-green-300 text-xs">{_t('createReservation.whatClient')}</span>
          </Label>
          <Select
            value={sellingCurrency}
            onValueChange={(v) => {
              setSellingCurrency(v);
              setExchangeRate(1);
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {acquiringCurrency !== sellingCurrency && (
          <>
            <div className="space-y-2">
              <Label>{_t('createReservation.exchange')}</Label>
              <Input
                type="number"
                step="0.0001"
                min="0.0001"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                className="w-32"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={fetchExchangeRate}
              disabled={loadingRate}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loadingRate ? 'animate-spin' : ''}`} />
              {loadingRate ? 'Fetching...' : 'Live Rate'}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
