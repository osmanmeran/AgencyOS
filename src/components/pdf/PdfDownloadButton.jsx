import { Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApi } from '@/hooks/useApi';

const LABELS = {
  booking: { icon: FileText, label: 'Booking Confirmation', endpoint: 'booking' },
  proposal: { icon: FileText, label: 'Proposal', endpoint: 'proposal' },
  invoice: { icon: FileText, label: 'Invoice', endpoint: 'invoice' },
};

export default function PdfDownloadButton({ type = 'proposal', data = {}, children, variant = 'outline', size = 'sm', className = '' }) {
  const config = LABELS[type] || LABELS.proposal;
  const { request, loading } = useApi();
  const Icon = config.icon;

  const handleGenerate = async () => {
    try {
      const result = await request(`/api/pdf/${config.endpoint}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const { filename } = await result;
      const link = document.createElement('a');
      link.href = `/api/pdf/download/${filename}`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('PDF generation failed:', err);
    }
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={handleGenerate} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Icon className="w-4 h-4 mr-1" />}
      {children || `Download ${config.label}`}
    </Button>
  );
}
