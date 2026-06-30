const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Loader2, CheckCircle, Plus, Globe } from 'lucide-react';

export default function MarketPriceAnalyzer() {
  const [description, setDescription] = useState('');
  const [destination, setDestination] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [importing, setImporting] = useState(/** @type {any} */ ({}));
  const [imported, setImported] = useState(/** @type {any} */ ({}));
  const queryClient = useQueryClient();

  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['supplierCategories'],
    queryFn: () => db.entities.SupplierCategory.list()
  }));

  const { data: suppliers = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['suppliers'],
    queryFn: () => db.entities.Supplier.list()
  }));

  const analyze = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setResults(null);
    try {
      const prompt = `You are a travel industry pricing expert. Analyze the following travel services/products and provide realistic current market prices.

Services/Products to analyze:
${description}

${destination ? `Destination/Region: ${destination}` : ''}
Currency: ${currency}

For each service or product mentioned, provide:
1. Service name
2. Category (hotel, transfer, guided_tour, restaurant, activity, flight, other)
3. Estimated market price (low range)
4. Estimated market price (high range)  
5. Suggested selling price (with ~20-25% margin)
6. Unit (per_person, per_night, per_day, per_trip, flat_rate)
7. Brief notes about what affects pricing

Return a JSON with this structure:
{
  "services": [
    {
      "name": "string",
      "category": "string",
      "description": "string",
      "market_price_low": number,
      "market_price_high": number,
      "suggested_price": number,
      "unit": "string",
      "currency": "${currency}",
      "notes": "string"
    }
  ],
  "market_summary": "string (2-3 sentences about the market context)"
}`;

      const response = await db.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            services: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string' },
                  description: { type: 'string' },
                  market_price_low: { type: 'number' },
                  market_price_high: { type: 'number' },
                  suggested_price: { type: 'number' },
                  unit: { type: 'string' },
                  currency: { type: 'string' },
                  notes: { type: 'string' },
                }
              }
            },
            market_summary: { type: 'string' }
          }
        }
      });
      setResults(response);
    } finally {
      setLoading(false);
    }
  };

  const importPricing = async (svc, idx) => {
    setImporting(p => ({ ...p, [idx]: true }));
    try {
      // Find or create a matching category
      const catKeywords = {
        hotel: ['hotel', 'lodging', 'accommodation'],
        transfer: ['transfer', 'transport', 'taxi'],
        guided_tour: ['tour', 'guided', 'excursion'],
        restaurant: ['restaurant', 'dining', 'food'],
        activity: ['activity', 'entertainment', 'sport'],
        flight: ['flight', 'airline', 'aviation'],
      };
      let _matchedCatId = categories[0]?.id || null;
      for (const [, keywords] of Object.entries(catKeywords)) {
        if (keywords.some(kw => svc.category.toLowerCase().includes(kw) || svc.name.toLowerCase().includes(kw))) {
          const found = categories.find(c => keywords.some(kw => c.name.toLowerCase().includes(kw)));
          if (found) { _matchedCatId = found.id; break; }
        }
      }

      // Create a SupplierPricing record (linked to first matching supplier or standalone)
      const matchingSupplier = suppliers.find(s =>
        s.name.toLowerCase().includes(svc.name.toLowerCase().split(' ')[0]) ||
        svc.name.toLowerCase().includes(s.name.toLowerCase().split(' ')[0])
      );

      await db.entities.SupplierPricing.create({
        supplier_id: matchingSupplier?.id || null,
        name: svc.name,
        description: `${svc.description}\n\nMarket range: ${svc.currency}${svc.market_price_low}–${svc.market_price_high}/${svc.unit}\nNotes: ${svc.notes}`,
        base_price: svc.market_price_low,
        client_price: svc.suggested_price,
        currency: svc.currency,
        unit: svc.unit,
        is_active: true,
        approval_status: 'pending',
      });
      setImported(p => ({ ...p, [idx]: true }));
      queryClient.invalidateQueries({ queryKey: ['supplierPricing'] });
    } finally {
      setImporting(p => ({ ...p, [idx]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 bg-purple-50 border-purple-200">
        <h3 className="font-bold text-purple-900 mb-1 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />AI Market Price Analyzer
        </h3>
        <p className="text-sm text-purple-700">
          Describe travel services or products and our AI will research current market prices, suggest selling prices, and import them into your pricing database.
        </p>
      </Card>

      <Card className="p-6 bg-white shadow-sm">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-semibold">Describe services/products to analyze *</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={`Example:\n- 5-star hotel room in Paris\n- Airport transfer for 2 people\n- Full-day city tour with guide\n- Dinner at fine dining restaurant\n- Museum entrance tickets`}
              rows={6}
              className="font-mono text-sm"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Destination / Region (optional)</Label>
              <Input value={destination} onChange={e => setDestination(e.target.value)} placeholder="e.g., Paris, France or Southeast Asia" />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['USD','EUR','GBP','TRY','AED','SAR','EGP','MAD'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={analyze} disabled={loading || !description.trim()} className="bg-purple-600 hover:bg-purple-700 w-full">
            {loading
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing market prices...</>
              : <><Globe className="w-4 h-4 mr-2" />Analyze with AI + Live Market Data</>
            }
          </Button>
          <p className="text-xs text-slate-400 text-center">Uses AI with internet search for up-to-date pricing. Results are estimates.</p>
        </div>
      </Card>

      {results && (
        <div className="space-y-4">
          {results.market_summary && (
            <Card className="p-4 bg-slate-50 border-slate-200">
              <p className="text-sm text-slate-700 italic">{results.market_summary}</p>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.services?.map((svc, idx) => (
              <Card key={idx} className="p-5 bg-white shadow-sm border border-slate-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-slate-900">{svc.name}</h4>
                    <Badge className="bg-purple-100 text-purple-700 text-xs mt-1">{svc.category}</Badge>
                  </div>
                  {imported[idx]
                    ? <Badge className="bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Imported</Badge>
                    : <Button size="sm" variant="outline" onClick={() => importPricing(svc, idx)} disabled={importing[idx]} className="text-purple-700 border-purple-200">
                        {importing[idx] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                        {importing[idx] ? 'Saving...' : 'Import Price'}
                      </Button>
                  }
                </div>

                <p className="text-sm text-slate-600 mb-3">{svc.description}</p>

                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="bg-amber-50 rounded p-2">
                    <div className="text-xs text-slate-500">Market Low</div>
                    <div className="font-bold text-amber-700">{svc.currency}{svc.market_price_low?.toFixed(0)}</div>
                  </div>
                  <div className="bg-orange-50 rounded p-2">
                    <div className="text-xs text-slate-500">Market High</div>
                    <div className="font-bold text-orange-700">{svc.currency}{svc.market_price_high?.toFixed(0)}</div>
                  </div>
                  <div className="bg-green-50 rounded p-2">
                    <div className="text-xs text-slate-500">Suggested Sell</div>
                    <div className="font-bold text-green-700">{svc.currency}{svc.suggested_price?.toFixed(0)}</div>
                  </div>
                </div>

                <div className="text-xs text-slate-400 flex justify-between">
                  <span>Per: {svc.unit?.replace(/_/g, ' ')}</span>
                </div>
                {svc.notes && <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded p-2">{svc.notes}</p>}
              </Card>
            ))}
          </div>

          <div className="text-center">
            <Button variant="outline" onClick={() => { setResults(null); setDescription(''); }}>
              Analyze More Services
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}