import { db } from '@/lib/DbContext';

import { useState } from 'react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRightLeft, RefreshCw, Loader2 } from 'lucide-react';

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
];

export default function CurrencyConverter({ compact = false }) {
  const [amount, setAmount] = useState('100');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('TRY');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const convertCurrency = async () => {
    setLoading(true);
    try {
      const response = await db.integrations.Core.GetExchangeRate(fromCurrency, toCurrency);
      const rate = response.rate;
      const convertedAmount = parseFloat(amount) * rate;
      setResult({
        rate,
        converted_amount: convertedAmount,
        source_currency: fromCurrency,
        target_currency: toCurrency,
      });
    } catch {
      setResult(null);
    }
    setLoading(false);
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setResult(null);
  };

  const getCurrencySymbol = (code) => CURRENCIES.find((c) => c.code === code)?.symbol || code;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-24" />
        <Select value={fromCurrency} onValueChange={setFromCurrency}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={swapCurrencies}>
          <ArrowRightLeft className="w-4 h-4" />
        </Button>
        <Select value={toCurrency} onValueChange={setToCurrency}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={convertCurrency} size="sm" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Convert'}
        </Button>
        {result && (
          <span className="font-bold text-green-700 dark:text-green-300">
            {getCurrencySymbol(toCurrency)}
            {result.converted_amount?.toFixed(2)}
          </span>
        )}
      </div>
    );
  }

  return (
    <Card className="p-6 bg-card">
      <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <ArrowRightLeft className="w-5 h-5 text-blue-600 dark:text-blue-300" />
        Currency Converter
      </h3>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setResult(null);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>From</Label>
            <Select
              value={fromCurrency}
              onValueChange={(v) => {
                setFromCurrency(v);
                setResult(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.symbol} {c.code} - {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Select
              value={toCurrency}
              onValueChange={(v) => {
                setToCurrency(v);
                setResult(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.symbol} {c.code} - {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={swapCurrencies} variant="outline" className="flex-1">
            <ArrowRightLeft className="w-4 h-4 mr-2" /> Swap
          </Button>
          <Button onClick={convertCurrency} className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Converting...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" /> Get Rate
              </>
            )}
          </Button>
        </div>

        {result && (
          <div className="p-4 bg-green-50 dark:bg-green-950/40 rounded-lg border border-green-200 dark:border-green-800">
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">
                {amount} {fromCurrency} =
              </div>
              <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                {getCurrencySymbol(toCurrency)} {result.converted_amount?.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                Rate: 1 {fromCurrency} = {result.rate?.toFixed(4)} {toCurrency}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
