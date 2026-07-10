import { Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApi } from '@/hooks/useApi';
import { useT } from '@/lib/i18n/I18nContext';

const ENDPOINTS = {
  booking: { icon: FileText, endpoint: 'booking' },
  proposal: { icon: FileText, endpoint: 'proposal' },
  invoice: { icon: FileText, endpoint: 'invoice' },
};

export default function PdfDownloadButton({
  type = 'proposal',
  data = {},
  children,
  variant = 'outline',
  size = 'sm',
  className = '',
}) {
  const { t } = useT();
  const LABELS = {
    booking: t('pdfDownload.bookingConfirmation'),
    proposal: t('pdfDownload.proposal'),
    invoice: t('pdfDownload.invoice'),
  };
  const config = ENDPOINTS[type] || ENDPOINTS.proposal;
  const label = LABELS[type] || LABELS.proposal;
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
    } catch {
      /* ignore */
    }
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={handleGenerate} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Icon className="w-4 h-4 mr-1" />}
      {children || t('pdfDownload.downloadLabel', { label })}
    </Button>
  );
}
