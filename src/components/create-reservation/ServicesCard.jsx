import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Plus, TrendingUp } from 'lucide-react';
import ServiceLineEditor from '@/components/services/ServiceLineEditor';
import { currSymbol } from './helpers';

export default function ServicesCard({
  services,
  setServices,
  categories,
  passengerCount,
  addService,
  removeService,
  duplicateService,
  acquiringByCurrency,
  sellingByCurrency,
  currenciesMixed,
  markupPct,
  setMarkupPct,
  margin,
  finalTotal,
  acquiringCurrency,
  sellingCurrency,
}) {
  return (
    <Card className="p-6 bg-card shadow-md">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Services & Pricing</h2>
          <p className="text-sm text-muted-foreground">
            Acq. in <strong>{acquiringCurrency}</strong> · Sell in <strong>{sellingCurrency}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={addService} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {services.map((service) => {
          const mergeSvc = (updated) =>
            setServices((prev) => prev.map((s) => (s._key === service._key ? { ...s, ...updated } : s)));
          return (
            <ServiceLineEditor
              key={service._key}
              service={service}
              services={services}
              categories={categories}
              _passengerCount={passengerCount}
              onUpdate={mergeSvc}
              onChange={mergeSvc}
              onRemove={() => removeService(service._key)}
              onDuplicate={() => duplicateService(service._key)}
            />
          );
        })}
      </div>

      {/* Cost Summary */}
      {services.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border">
          <div className="flex justify-end">
            <div className="w-96 space-y-3">
              {Object.entries(acquiringByCurrency).map(([cur, total]) => (
                <div key={`acq-${cur}`} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cost ({cur})</span>
                  <span className="font-semibold text-red-600 dark:text-red-300">
                    {currSymbol(cur)}
                    {total.toFixed(2)}
                  </span>
                </div>
              ))}
              {Object.entries(sellingByCurrency).map(([cur, total]) => (
                <div key={`sell-${cur}`} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Selling ({cur})</span>
                  <span className="font-semibold text-green-700 dark:text-green-300">
                    {currSymbol(cur)}
                    {total.toFixed(2)}
                  </span>
                </div>
              ))}
              {!currenciesMixed && (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-orange-500 dark:text-orange-300" />
                      <span className="font-medium">Markup</span>
                      <Input
                        type="number"
                        min="0"
                        max="200"
                        step="0.5"
                        value={markupPct}
                        onChange={(e) => setMarkupPct(parseFloat(e.target.value) || 0)}
                        className="w-16 h-7 text-xs text-center px-1"
                      />
                      <span className="text-muted-foreground text-xs">%</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Applied to each line</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gross Margin</span>
                    <span
                      className={`font-semibold ${margin >= 0 ? 'text-blue-600 dark:text-blue-300' : 'text-red-600 dark:text-red-300'}`}
                    >
                      {margin.toFixed(1)}%
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <div className="text-lg font-bold text-foreground">Total</div>
                      <div className="text-xs text-muted-foreground">Client price ({sellingCurrency})</div>
                    </div>
                    <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                      {currSymbol(sellingCurrency)}
                      {finalTotal.toFixed(2)}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
