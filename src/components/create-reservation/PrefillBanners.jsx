import { ClipboardCheck, Loader2 } from 'lucide-react';

export default function PrefillBanners({
  isFromQuote,
  sourceQuote,
  quoteLoading,
  quotePricingLookup,
  isFromProposal,
  sourceProposal,
  proposalLoading,
}) {
  return (
    <>
      {isFromQuote && sourceQuote && (
        <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-purple-600 dark:text-purple-300 flex-shrink-0" />
          <span className="text-sm text-purple-800 dark:text-purple-300">
            Prefilled from Quote Request <strong>&ldquo;{sourceQuote.title}&rdquo;</strong> — review services and
            passenger details before creating.
          </span>
        </div>
      )}
      {isFromQuote && (quoteLoading || !quotePricingLookup) && (
        <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading quote request data…
        </div>
      )}

      {isFromProposal && sourceProposal && (
        <div className="p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-green-600 dark:text-green-300 flex-shrink-0" />
          <span className="text-sm text-green-800 dark:text-green-300">
            Prefilled from Proposal <strong>&ldquo;{sourceProposal.title}&rdquo;</strong> — review services and
            passenger details before creating. The proposal will be linked to this reservation.
          </span>
        </div>
      )}
      {isFromProposal && proposalLoading && (
        <div className="p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading proposal data…
        </div>
      )}
    </>
  );
}
