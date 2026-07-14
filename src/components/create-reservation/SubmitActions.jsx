import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

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
  return (
    <div className="flex justify-end gap-3 pb-8">
      <Link to={createPageUrl('Reservations')}>
        <Button type="button" variant="outline">
          Cancel
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
            Saving...
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
