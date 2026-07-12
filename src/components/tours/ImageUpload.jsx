import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, X } from 'lucide-react';
import { showError } from '@/lib/toast';

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Image picker that uploads the selected file to the shared documents store
 * (/api/documents/upload) and reports back the served URL. Used for tour
 * cover photos and per-day images.
 */
export default function ImageUpload({ value, onChange, label }) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('entity_type', 'GuidedTour');
      form.append('entity_id', 'image');
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'X-CSRF-Token': getCsrfToken() },
        credentials: 'include',
        body: form,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const doc = data.document || {};
      const url = doc.url || (doc.stored_name ? `/uploads/${doc.stored_name}` : '');
      if (url) onChange(url);
      else throw new Error('No URL returned');
    } catch (err) {
      showError('Upload failed', err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="w-20 h-20 object-cover rounded-md border" />
        ) : (
          <div className="w-20 h-20 rounded-md border border-dashed flex items-center justify-center text-muted-foreground text-[10px] text-center px-1">
            No image
          </div>
        )}
        <div className="flex flex-col gap-2">
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
            <span className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border hover:bg-accent">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Uploading…' : 'Upload'}
            </span>
          </label>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
              <X className="w-3.5 h-3.5" /> Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
