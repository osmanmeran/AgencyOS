import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { useT } from '@/lib/i18n/I18nContext';

export default function SubmitActions({
  isEditing,
  isFromQuote,
  quoteLoading,
  quotePricingLookup,
  isFromProposal,
  proposalLoading,
  createPending,
  updatePending,
}) {
  const { t: _t } = useT();
  return (
    <div className="flex justify-end gap-3 pb-8">
      <Link to={createPageUrl('Reservations')}>
        <Button type="button" variant="outline">
          {_t('createReservation.cancel')}
        </Button>
      </Link>
      <Button
        type="submit"
        className="bg-blue-600 hover:bg-blue-700"
        disabled={
          createPending ||
          updatePending ||
          (isFromQuote && (quoteLoading || !quotePricingLookup)) ||
          (isFromProposal && proposalLoading)
        }
      >
        {createPending || updatePending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {_t('createReservation.saving')}
          </>
        ) : isEditing ? (
          'Save Changes'
        ) : (
          'Create Reservation'
        )}
      </Button>
    </div>
  );
}
