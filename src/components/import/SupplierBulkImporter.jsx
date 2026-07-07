import { db } from '@/lib/DbContext';

import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Upload,
  Truck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Download,
  Wand2,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  DollarSign,
} from 'lucide-react';

import { parseCsv } from '@/lib/csv';

const SUPPLIER_FIELDS = [
  'name',
  'contact_person',
  'email',
  'phone',
  'website',
  'address',
  'city',
  'area',
  'pricing_info',
  'notes',
  'rating',
];
const UNITS = ['per_person', 'per_night', 'per_day', 'per_trip', 'per_hour', 'flat_rate'];
const STEPS = ['upload', 'mapping', 'prices', 'results'];

// ── Main Component ────────────────────────────────────────────────────────────
export default function SupplierBulkImporter() {
  const [step, setStep] = useState('upload'); // upload → mapping → prices → results
  const [parsed, setParsed] = useState(null);
  const [mapping, setMapping] = useState(/** @type {any} */ ({}));
  const [defaultCategory, setDefaultCategory] = useState('');
  const [aiMappingLoading, setAiMappingLoading] = useState(false);
  const [priceAnalysisLoading, setPriceAnalysisLoading] = useState(false);
  const [analyzedPrices, setAnalyzedPrices] = useState([]); // [{supplierName, serviceName, basePrice, clientPrice, currency, unit, notes}]
  const [selectedPrices, setSelectedPrices] = useState(/** @type {any} */ ({})); // idx → bool
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const fileRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: categories = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierCategories'],
      queryFn: () => db.entities.SupplierCategory.list(),
    })
  );

  // ── File Upload ──────────────────────────────────────────────────────────────
  const handleFile = (f) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = parseCsv(e.target.result);
      const headers = raw.length > 0 ? Object.keys(raw[0]) : [];
      const data = { headers, rows: raw };
      setParsed(data);
      // Auto-map obvious headers
      const autoMap = {};
      data.headers.forEach((h) => {
        const hl = h.toLowerCase().replace(/[\s_\-]/g, '');
        if (hl.includes('name') && !hl.includes('contact') && !hl.includes('service')) autoMap[h] = 'name';
        else if (hl.includes('contact') || hl.includes('person')) autoMap[h] = 'contact_person';
        else if (hl.includes('email') || hl.includes('mail')) autoMap[h] = 'email';
        else if (hl.includes('phone') || hl.includes('mobile') || hl.includes('tel')) autoMap[h] = 'phone';
        else if (hl.includes('website') || hl.includes('url') || hl.includes('web')) autoMap[h] = 'website';
        else if (hl.includes('address') || hl.includes('street')) autoMap[h] = 'address';
        else if (hl.includes('city')) autoMap[h] = 'city';
        else if (hl.includes('area') || hl.includes('region') || hl.includes('zone')) autoMap[h] = 'area';
        else if (hl.includes('rating') || hl.includes('stars') || hl.includes('score')) autoMap[h] = 'rating';
        else if (hl.includes('note') || hl.includes('comment') || hl.includes('remark')) autoMap[h] = 'notes';
        else if (hl.includes('price') || hl.includes('rate') || hl.includes('cost') || hl.includes('tariff'))
          autoMap[h] = 'pricing_info';
      });
      setMapping(autoMap);
      setStep('mapping');
    };
    reader.readAsText(f);
  };

  // ── AI Column Mapping ────────────────────────────────────────────────────────
  const runAiMapping = async () => {
    if (!parsed) return;
    setAiMappingLoading(true);
    try {
      const res = await db.integrations.Core.InvokeLLM({
        prompt: `Map these CSV column headers to supplier database fields.

CSV Headers: ${parsed.headers.join(', ')}
Sample first row: ${JSON.stringify(parsed.rows[0])}
Available database fields: ${SUPPLIER_FIELDS.join(', ')}

Return a JSON object mapping each CSV header to the best matching database field, or null if no match.
Example: {"Company Name": "name", "Contact": "contact_person", "E-mail": "email"}`,
        response_json_schema: { type: 'object', additionalProperties: true },
      });
      const valid = {};
      for (const [k, v] of Object.entries(res)) {
        if (SUPPLIER_FIELDS.includes(v)) valid[k] = v;
      }
      setMapping(valid);
    } finally {
      setAiMappingLoading(false);
    }
  };

  // ── AI Price Analysis ────────────────────────────────────────────────────────
  const runPriceAnalysis = async () => {
    if (!parsed) return;
    setPriceAnalysisLoading(true);
    try {
      // Build a concise representation of all rows for the AI
      //       const nameField = Object.keys(mapping).find(k => mapping[k] === 'name');
      const rows = parsed.rows.map((row) => {
        const entry = {};
        parsed.headers.forEach((h) => {
          if (row[h]) entry[h] = row[h];
        });
        return entry;
      });

      const res = await db.integrations.Core.InvokeLLM({
        prompt: `You are a travel industry pricing expert. Analyze the following supplier data extracted from a CSV file and extract ALL pricing information.

Supplier rows:
${JSON.stringify(rows.slice(0, 50), null, 2)}

For each row that has pricing data, extract:
1. Supplier name (from the data)
2. Service/product name (what they are selling)
3. Base price (cost/buying price - the lowest price mentioned)
4. Client price (selling price - with ~20-25% margin if only one price exists)
5. Currency (default USD if not clear)
6. Unit (per_person, per_night, per_day, per_trip, per_hour, flat_rate)
7. Notes about the pricing

If a row has no pricing data, skip it.
If multiple prices exist in one row (e.g. per person and per group), create multiple entries.

Return JSON:
{
  "prices": [
    {
      "supplier_name": "string",
      "service_name": "string",
      "base_price": number,
      "client_price": number,
      "currency": "USD",
      "unit": "per_person",
      "notes": "string"
    }
  ],
  "summary": "string (brief summary of what was found)"
}`,
        response_json_schema: {
          type: 'object',
          properties: {
            prices: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  supplier_name: { type: 'string' },
                  service_name: { type: 'string' },
                  base_price: { type: 'number' },
                  client_price: { type: 'number' },
                  currency: { type: 'string' },
                  unit: { type: 'string' },
                  notes: { type: 'string' },
                },
              },
            },
            summary: { type: 'string' },
          },
        },
      });

      const prices = (res.prices || []).map((p) => ({ ...p, _summary: res.summary }));
      setAnalyzedPrices(prices);
      const sel = {};
      prices.forEach((_, i) => (sel[i] = true));
      setSelectedPrices(sel);
      setStep('prices');
    } finally {
      setPriceAnalysisLoading(false);
    }
  };

  // ── Update a price field inline ──────────────────────────────────────────────
  const updatePrice = (idx, field, value) => {
    setAnalyzedPrices((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  // ── Final Import ─────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!parsed || !defaultCategory) return;
    setImporting(true);
    let suppliersOk = 0,
      suppliersSkip = 0,
      pricesOk = 0;
    const errors = [];

    // 1. Import suppliers
    const supplierIdMap = {}; // name → id
    const defaultCategoryName = categories.find((c) => c.id === defaultCategory)?.name || 'General';
    for (const row of parsed.rows) {
      try {
        const supplier = {};
        for (const [header, field] of Object.entries(mapping)) {
          if (field && row[header] !== undefined && row[header] !== '') {
            if (field === 'rating') supplier[field] = Math.min(5, Math.max(1, parseInt(row[header]) || 3));
            else supplier[field] = row[header];
          }
        }
        if (!supplier.name) {
          suppliersSkip++;
          continue;
        }
        const existing = await db.entities.Supplier.filter({ name: supplier.name });
        if (existing.length > 0) {
          supplierIdMap[supplier.name] = existing[0].id;
          suppliersSkip++;
          continue;
        }
        const created = await db.entities.Supplier.create(supplier);
        // A supplier's category comes from its subcategories — seed a
        // default one for the category picked for this import batch.
        await db.entities.SupplierSubcategory.create({
          supplier_id: created.id,
          category_id: defaultCategory,
          name: defaultCategoryName,
        });
        supplierIdMap[supplier.name] = created.id;
        suppliersOk++;
      } catch (e) {
        errors.push(e.message);
      }
    }

    // 2. Import selected prices
    const selectedList = analyzedPrices.filter((_, i) => selectedPrices[i]);
    for (const price of selectedList) {
      try {
        const supplierId = supplierIdMap[price.supplier_name] || null;
        await db.entities.SupplierPricing.create({
          supplier_id: supplierId,
          name: price.service_name,
          description: price.notes || '',
          base_price: parseFloat(price.base_price) || 0,
          client_price: parseFloat(price.client_price) || 0,
          currency: price.currency || 'USD',
          unit: price.unit || 'per_person',
          is_active: true,
          approval_status: 'pending',
        });
        pricesOk++;
      } catch (e) {
        errors.push(`Price for ${price.supplier_name}: ${e.message}`);
      }
    }

    setImporting(false);
    setResults({ suppliersOk, suppliersSkip, pricesOk, errors });
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    queryClient.invalidateQueries({ queryKey: ['supplierPricing'] });
    queryClient.invalidateQueries({ queryKey: ['allSupplierSubcategories'] });
    setStep('results');
  };

  const reset = () => {
    setParsed(null);
    setMapping({});
    setDefaultCategory('');
    setAnalyzedPrices([]);
    setSelectedPrices({});
    setResults(null);
    setStep('upload');
  };

  // ── Step Indicator ───────────────────────────────────────────────────────────
  const stepLabels = ['Upload', 'Map Columns', 'Review Prices', 'Done'];
  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-5 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800">
        <h3 className="font-bold text-orange-900 dark:text-orange-300 mb-1 flex items-center gap-2">
          <Truck className="w-4 h-4" />
          Bulk Supplier Import with AI Price Analysis
        </h3>
        <p className="text-sm text-orange-700 dark:text-orange-300">
          Upload any CSV. AI maps columns, then extracts and analyzes all pricing data for your review before importing
          into the database.
        </p>
      </Card>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {stepLabels.map((label, i) => (
          <React.Fragment key={label}>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${i <= stepIndex ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300' : 'bg-muted text-muted-foreground'}`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${i < stepIndex ? 'bg-green-500 text-white' : i === stepIndex ? 'bg-orange-500 text-white' : 'bg-muted-foreground text-background'}`}
              >
                {i < stepIndex ? '✓' : i + 1}
              </span>
              {label}
            </div>
            {i < stepLabels.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {/* ── STEP 1: Upload ── */}
      {step === 'upload' && (
        <Card
          className="p-14 border-2 border-dashed border-border bg-card hover:border-orange-400 transition-colors cursor-pointer text-center"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files[0]);
          }}
        >
          <Upload className="w-14 h-14 text-muted-foreground mx-auto mb-3" />
          <p className="text-xl font-semibold text-foreground">Drop your Supplier CSV here</p>
          <p className="text-sm text-muted-foreground mt-2">CSV or TXT — any column format. AI will handle the rest.</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <Button
            variant="outline"
            size="sm"
            className="mt-6 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800"
            onClick={(e) => {
              e.stopPropagation();
              const sample =
                'Company Name,Contact Person,Email,Phone,City,Region,Rating,Service,Net Price,Selling Price,Currency,Unit,Notes\nSunrise Hotels,Ahmed Al-Rashid,ahmed@sunrise.com,+971-50-1234567,Dubai,UAE,5,Deluxe Room per Night,120,180,USD,per_night,Breakfast included\nBlue Ocean Transfers,Maria Santos,maria@bluetransfer.com,+34-91-5678901,Madrid,Spain,4,Airport Transfer,45,70,EUR,per_trip,Meet & greet included';
              const blob = new Blob([sample], { type: 'text/csv' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'supplier_sample.csv';
              a.click();
            }}
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Download Sample CSV
          </Button>
        </Card>
      )}

      {/* ── STEP 2: Column Mapping ── */}
      {step === 'mapping' && parsed && (
        <div className="space-y-4">
          <Card className="p-6 bg-card shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-foreground text-lg">Map Columns</h3>
                <p className="text-sm text-muted-foreground">
                  {parsed.rows.length} rows detected · Map your CSV headers to supplier fields
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={runAiMapping}
                disabled={aiMappingLoading}
                className="text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
              >
                {aiMappingLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-2" />
                )}
                AI Auto-Map
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {parsed.headers.map((header) => (
                <div key={header} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-40 truncate font-mono bg-muted px-2 py-1.5 rounded border flex-shrink-0">
                    {header}
                  </span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <Select
                    value={mapping[header] || '__ignore__'}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [header]: v === '__ignore__' ? null : v }))}
                  >
                    <SelectTrigger className="flex-1 h-8 text-sm">
                      <SelectValue placeholder="Ignore" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ignore__">— Ignore —</SelectItem>
                      {SUPPLIER_FIELDS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-2">
              <Label className="font-semibold">Default Category (required) *</Label>
              <Select value={defaultCategory} onValueChange={setDefaultCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category for imported suppliers" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Sample preview */}
          <Card className="p-5 bg-card shadow-sm">
            <h4 className="font-semibold text-foreground mb-3 text-sm">Preview (first 5 rows)</h4>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    {Object.entries(mapping)
                      .filter(([, v]) => v)
                      .map(([h]) => (
                        <th key={h} className="px-3 py-2 text-left text-muted-foreground whitespace-nowrap font-medium">
                          {h}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsed.rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="hover:bg-muted">
                      {Object.entries(mapping)
                        .filter(([, v]) => v)
                        .map(([h]) => (
                          <td key={h} className="px-3 py-2 text-foreground max-w-40 truncate">
                            {row[h] || '—'}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={reset}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button
              onClick={runPriceAnalysis}
              disabled={priceAnalysisLoading || !defaultCategory}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {priceAnalysisLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing prices with AI...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Analyze Prices with AI
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Review Prices ── */}
      {step === 'prices' && (
        <div className="space-y-4">
          {analyzedPrices.length === 0 ? (
            <Card className="p-8 bg-card shadow-sm text-center">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="font-semibold text-foreground">No pricing data found in the file</p>
              <p className="text-sm text-muted-foreground mt-1">
                The AI could not detect any prices. Suppliers will still be imported without pricing.
              </p>
            </Card>
          ) : (
            <Card className="p-5 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800">
              <p className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                AI found <strong>{analyzedPrices.length} price entries</strong>. Review and edit below before importing.
              </p>
              {analyzedPrices[0]?._summary && (
                <p className="text-xs text-green-700 dark:text-green-300 mt-1 italic">{analyzedPrices[0]._summary}</p>
              )}
            </Card>
          )}

          {/* Select all / deselect all */}
          {analyzedPrices.length > 0 && (
            <div className="flex gap-3 items-center">
              <span className="text-sm text-muted-foreground font-medium">
                {Object.values(selectedPrices).filter(Boolean).length} of {analyzedPrices.length} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const s = {};
                  analyzedPrices.forEach((_, i) => (s[i] = true));
                  setSelectedPrices(s);
                }}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const s = {};
                  analyzedPrices.forEach((_, i) => (s[i] = false));
                  setSelectedPrices(s);
                }}
              >
                Deselect All
              </Button>
            </div>
          )}

          {/* Price cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analyzedPrices.map((price, idx) => (
              <Card
                key={idx}
                className={`p-4 border-2 transition-all ${selectedPrices[idx] ? 'border-orange-300 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-950/30' : 'border-border bg-card opacity-60'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!selectedPrices[idx]}
                      onChange={(e) => setSelectedPrices((s) => ({ ...s, [idx]: e.target.checked }))}
                      className="w-4 h-4 mt-0.5"
                    />
                    <div>
                      <p className="font-semibold text-foreground text-sm">{price.service_name}</p>
                      <p className="text-xs text-muted-foreground">{price.supplier_name}</p>
                    </div>
                  </div>
                  <Badge className="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-xs">
                    {price.unit?.replace(/_/g, ' ')}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Net/Base Price</Label>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-muted-foreground">{price.currency}</span>
                      <Input
                        type="number"
                        value={price.base_price}
                        onChange={(e) => updatePrice(idx, 'base_price', e.target.value)}
                        className="h-7 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Selling Price</Label>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-muted-foreground">{price.currency}</span>
                      <Input
                        type="number"
                        value={price.client_price}
                        onChange={(e) => updatePrice(idx, 'client_price', e.target.value)}
                        className="h-7 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Currency</Label>
                    <Select value={price.currency} onValueChange={(v) => updatePrice(idx, 'currency', v)}>
                      <SelectTrigger className="h-7 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['USD', 'EUR', 'GBP', 'TRY', 'AED', 'SAR', 'EGP', 'MAD'].map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Unit</Label>
                    <Select value={price.unit} onValueChange={(v) => updatePrice(idx, 'unit', v)}>
                      <SelectTrigger className="h-7 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {price.notes && (
                  <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1 mt-1">{price.notes}</p>
                )}

                {/* Margin indicator */}
                {price.base_price > 0 && price.client_price > 0 && (
                  <div className="mt-2 text-xs font-medium text-right">
                    Margin:{' '}
                    <span
                      className={
                        parseFloat(price.client_price) > parseFloat(price.base_price)
                          ? 'text-green-600 dark:text-green-300'
                          : 'text-red-500 dark:text-red-300'
                      }
                    >
                      {(
                        ((parseFloat(price.client_price) - parseFloat(price.base_price)) /
                          parseFloat(price.base_price)) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                )}
              </Card>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button variant="outline" onClick={() => setStep('mapping')}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to Mapping
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || !defaultCategory}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Suppliers + {Object.values(selectedPrices).filter(Boolean).length} Prices
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Results ── */}
      {step === 'results' && results && (
        <Card className="p-6 bg-card shadow-sm">
          <h3 className="font-bold text-foreground text-xl mb-6 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-500 dark:text-green-300" />
            Import Complete
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 dark:bg-green-950/40 rounded-xl p-4 text-center border border-green-100">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-300 mx-auto mb-1" />
              <div className="text-3xl font-bold text-green-700 dark:text-green-300">{results.suppliersOk}</div>
              <div className="text-sm text-green-600 dark:text-green-300">Suppliers Added</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/40 rounded-xl p-4 text-center border border-amber-100">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-300 mx-auto mb-1" />
              <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">{results.suppliersSkip}</div>
              <div className="text-sm text-amber-600 dark:text-amber-300">Suppliers Skipped</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/40 rounded-xl p-4 text-center border border-blue-100">
              <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-300 mx-auto mb-1" />
              <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{results.pricesOk}</div>
              <div className="text-sm text-blue-600 dark:text-blue-300">Prices Imported</div>
            </div>
            <div className="bg-red-50 dark:bg-red-950/40 rounded-xl p-4 text-center border border-red-100">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-300 mx-auto mb-1" />
              <div className="text-3xl font-bold text-red-700 dark:text-red-300">{results.errors.length}</div>
              <div className="text-sm text-red-600 dark:text-red-300">Errors</div>
            </div>
          </div>

          {results.errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950/40 rounded-lg p-3 text-sm text-red-700 dark:text-red-300 space-y-1 mb-4">
              {results.errors.slice(0, 5).map((e, i) => (
                <div key={i}>• {e}</div>
              ))}
            </div>
          )}

          <Button onClick={reset} className="bg-orange-600 hover:bg-orange-700">
            Import Another File
          </Button>
        </Card>
      )}
    </div>
  );
}
