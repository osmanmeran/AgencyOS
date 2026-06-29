const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Users, CheckCircle, XCircle, AlertTriangle, Loader2, Download, Eye, EyeOff } from 'lucide-react';
import { parseCsv } from '@/lib/csv';

function parseOutlookCSV(text) {
  const rows = parseCsv(text);
  if (rows.length < 1) return [];
  const headers = Object.keys(rows[0]).map(h => h.toLowerCase().trim());

  const fieldMap = {
    name: ['first name', 'last name', 'display name', 'full name', 'name'],
    email: ['e-mail address', 'email address', 'email', 'e-mail'],
    phone: ['business phone', 'mobile phone', 'home phone', 'phone', 'mobile'],
    company: ['company', 'organization', 'company name'],
    address: ['business street', 'home street', 'address', 'street'],
    city: ['business city', 'home city', 'city'],
    country: ['business country/region', 'home country/region', 'country'],
    notes: ['notes'],
  };

  const colIndex = {};
  for (const [field, possibleHeaders] of Object.entries(fieldMap)) {
    for (const ph of possibleHeaders) {
      const idx = headers.findIndex(h => h.includes(ph));
      if (idx !== -1) { colIndex[field] = idx; break; }
    }
  }

  // Special handling for first + last name
  const firstIdx = headers.findIndex(h => h.includes('first name'));
  const lastIdx = headers.findIndex(h => h.includes('last name'));

  return rows.map(row => {
    const cols = Object.values(row);
    let name = '';
    if (firstIdx !== -1 || lastIdx !== -1) {
      name = [cols[firstIdx] || '', cols[lastIdx] || ''].filter(Boolean).join(' ').trim();
    }
    if (!name && colIndex.name !== undefined) name = cols[colIndex.name] || '';

    const contact = {
      name: name || 'Unknown',
      email: colIndex.email !== undefined ? (cols[colIndex.email] || '') : '',
      phone: colIndex.phone !== undefined ? (cols[colIndex.phone] || '') : '',
      company: colIndex.company !== undefined ? (cols[colIndex.company] || '') : '',
      address: colIndex.address !== undefined ? (cols[colIndex.address] || '') : '',
      city: colIndex.city !== undefined ? (cols[colIndex.city] || '') : '',
      country: colIndex.country !== undefined ? (cols[colIndex.country] || '') : '',
      notes: colIndex.notes !== undefined ? (cols[colIndex.notes] || '') : '',
      status: 'active',
      portal_access: false,
    };
    return contact;
  }).filter(c => c.name && c.name !== 'Unknown');
}

export default function OutlookContactsImporter() {
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState({});
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [showPreview, setShowPreview] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const queryClient = useQueryClient();

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseOutlookCSV(e.target.result);
      setContacts(parsed);
      const sel = {};
      parsed.forEach((_, i) => sel[i] = true);
      setSelected(sel);
      setResults(null);
    };
    reader.readAsText(file);
  };

  const toggleAll = (val) => {
    const sel = {};
    contacts.forEach((_, i) => sel[i] = val);
    setSelected(sel);
  };

  const selectedContacts = contacts.filter((_, i) => selected[i]);

  const handleImport = async () => {
    setImporting(true);
    let ok = 0, skip = 0, fail = 0;
    const errors = [];
    try {
      // Fetch all existing emails in one call to avoid rate limits
      const existing = await db.entities.Client.list();
      const existingEmails = new Set(existing.map(c => c.email?.toLowerCase()).filter(Boolean));

      // Filter out duplicates in-memory
      const toImport = selectedContacts.filter(c => {
        if (c.email && existingEmails.has(c.email.toLowerCase())) {
          skip++;
          return false;
        }
        return true;
      });

      // Batch create in chunks of 10 to avoid rate limits
      const chunkSize = 10;
      for (let i = 0; i < toImport.length; i += chunkSize) {
        const chunk = toImport.slice(i, i + chunkSize);
        try {
          await db.entities.Client.bulkCreate(chunk);
          ok += chunk.length;
        } catch (e) {
          // If bulk fails, try one by one for this chunk
          for (const contact of chunk) {
            try {
              await db.entities.Client.create(contact);
              ok++;
            } catch (err) {
              fail++;
              errors.push(`${contact.name}: ${err.message}`);
            }
          }
        }
      }
    } catch (e) {
      errors.push(`Import failed: ${e.message}`);
    }
    setImporting(false);
    setResults({ ok, skip, fail, errors });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Card className="p-5 bg-blue-50 border-blue-200">
        <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2"><Users className="w-4 h-4" />Import Outlook Contacts to CRM</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal ml-4">
          <li>In Outlook: go to <strong>People → Manage → Export contacts</strong> → choose "All contacts" → Save as CSV</li>
          <li>Upload the CSV file below</li>
          <li>Review the contacts and deselect any you don't want to import</li>
          <li>Click Import — duplicates (by email) are automatically skipped</li>
        </ol>
        <Button variant="outline" size="sm" className="mt-3 text-blue-700 border-blue-300"
          onClick={() => {
            const sample = 'First Name,Last Name,E-mail Address,Business Phone,Company,Business City,Business Country/Region,Notes\nJohn,Doe,john@example.com,+1-555-0100,Acme Corp,New York,USA,VIP client';
            const blob = new Blob([sample], { type: 'text/csv' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'outlook_sample.csv'; a.click();
          }}>
          <Download className="w-3.5 h-3.5 mr-1" />Download Sample CSV
        </Button>
      </Card>

      {/* Upload Area */}
      {contacts.length === 0 && (
        <Card
          className={`p-12 border-2 border-dashed transition-colors cursor-pointer text-center ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-400'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current.click()}
        >
          <Upload className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-lg font-medium text-slate-700">Drop your Outlook CSV here</p>
          <p className="text-sm text-slate-400 mt-1">or click to browse</p>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => handleFile(e.target.files[0])} />
        </Card>
      )}

      {/* Preview */}
      {contacts.length > 0 && !results && (
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">{contacts.length} contacts found</h3>
              <p className="text-sm text-slate-500">{selectedContacts.length} selected for import</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setShowPreview(p => !p)}>
                {showPreview ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                {showPreview ? 'Hide' : 'Show'} Preview
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>Select All</Button>
              <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>Deselect All</Button>
              <Button variant="outline" size="sm" onClick={() => { setContacts([]); setSelected({}); }} className="text-red-600 border-red-200">
                Clear
              </Button>
              <Button onClick={handleImport} disabled={importing || selectedContacts.length === 0} className="bg-blue-600 hover:bg-blue-700">
                {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</> : <><Upload className="w-4 h-4 mr-2" />Import {selectedContacts.length} Contacts</>}
              </Button>
            </div>
          </div>

          {showPreview && (
            <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left w-8"></th>
                    <th className="px-3 py-2 text-left text-slate-600">Name</th>
                    <th className="px-3 py-2 text-left text-slate-600">Email</th>
                    <th className="px-3 py-2 text-left text-slate-600">Phone</th>
                    <th className="px-3 py-2 text-left text-slate-600">Company</th>
                    <th className="px-3 py-2 text-left text-slate-600">City</th>
                    <th className="px-3 py-2 text-left text-slate-600">Country</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contacts.map((c, i) => (
                    <tr key={i} className={`hover:bg-slate-50 ${!selected[i] ? 'opacity-40' : ''}`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={!!selected[i]} onChange={e => setSelected(s => ({ ...s, [i]: e.target.checked }))} className="w-4 h-4" />
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">{c.name}</td>
                      <td className="px-3 py-2 text-slate-600">{c.email || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{c.phone || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{c.company || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{c.city || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{c.country || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Results */}
      {results && (
        <Card className="p-6 bg-white shadow-sm">
          <h3 className="font-bold text-slate-900 text-lg mb-4">Import Complete</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-green-700">{results.ok}</div>
              <div className="text-sm text-green-600">Imported</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 text-center">
              <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-amber-700">{results.skip}</div>
              <div className="text-sm text-amber-600">Skipped (duplicates)</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <XCircle className="w-6 h-6 text-red-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-red-700">{results.fail}</div>
              <div className="text-sm text-red-600">Failed</div>
            </div>
          </div>
          {results.errors.length > 0 && (
            <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700">
              {results.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          <Button className="mt-4" onClick={() => { setContacts([]); setSelected({}); setResults(null); }}>
            Import More
          </Button>
        </Card>
      )}
    </div>
  );
}