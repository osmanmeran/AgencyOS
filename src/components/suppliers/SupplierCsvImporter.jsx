import { db } from '@/lib/DbContext';

import { useRef, useState } from 'react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { parseCsv } from '@/lib/csv';

export default function SupplierCsvImporter({ open, onOpenChange, categories, onImported }) {
  const fileRef = useRef(null);
  const [results, setResults] = useState(null);
  const [importing, setImporting] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const rows = parseCsv(text);

    setImporting(true);
    const succeeded = [];
    const failed = [];

    for (const row of rows) {
      const name = row['name']?.trim();
      const categoryName = row['category']?.trim();

      if (!name) {
        failed.push({ row, reason: 'Missing required field: name' });
        continue;
      }

      const matchedCategory = categories.find(
        c => c.name.toLowerCase() === categoryName?.toLowerCase()
      );

      if (!matchedCategory) {
        failed.push({ row, reason: `Category "${categoryName}" not found` });
        continue;
      }

      try {
        await db.entities.Supplier.create({
          name,
          category_id: matchedCategory.id,
          contact_person: row['contact_person'] || '',
          email: row['email'] || '',
          phone: row['phone'] || '',
          website: row['website'] || '',
          city: row['city'] || '',
          area: row['area'] || '',
          notes: row['notes'] || '',
          rating: row['rating'] ? parseInt(row['rating']) : undefined,
        });
        succeeded.push(row);
      } catch (err) {
        failed.push({ row, reason: err?.message || 'Unknown error' });
      }
    }

    setImporting(false);
    setResults({ succeeded, failed });
    if (succeeded.length > 0) onImported();
    // reset file input
    e.target.value = '';
  };

  const downloadTemplate = () => {
    const csv = 'name,category,contact_person,email,phone,website,city,area,notes,rating\nExample Supplier,Hotels,John Doe,john@example.com,+1234567890,https://example.com,Paris,Ile-de-France,Good supplier,5\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'suppliers_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setResults(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Suppliers from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <p className="font-semibold mb-1">Required columns:</p>
            <p><span className="font-mono bg-blue-100 px-1 rounded">name</span>, <span className="font-mono bg-blue-100 px-1 rounded">category</span> (must match an existing category name)</p>
            <p className="mt-1 text-blue-600">Optional: contact_person, email, phone, website, city, area, notes, rating</p>
          </div>

          {/* Available categories */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Available categories</p>
            <div className="flex flex-wrap gap-1">
              {categories.map(c => (
                <Badge key={c.id} variant="outline" className="text-xs">{c.name}</Badge>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" />Upload CSV</>
              )}
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>

          {/* Results */}
          {results && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm font-medium">
                  <CheckCircle className="w-4 h-4" />
                  {results.succeeded.length} imported
                </div>
                <div className="flex items-center gap-1.5 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm font-medium">
                  <XCircle className="w-4 h-4" />
                  {results.failed.length} failed
                </div>
              </div>

              {results.failed.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Failed rows</p>
                  {results.failed.map((f, i) => (
                    <div key={i} className="text-xs bg-red-50 border border-red-200 rounded p-2">
                      <span className="font-semibold text-slate-700">{f.row.name || `Row ${i + 1}`}</span>
                      <span className="text-red-600 ml-2">— {f.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}