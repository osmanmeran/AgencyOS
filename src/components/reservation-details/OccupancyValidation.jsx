import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function OccupancyValidation({ trip }) {
  if (!(trip.passengers?.length > 0 && trip.services?.length > 0)) {
    return null;
  }

  const OCCUPANCY_CAPACITY = { Single: 1, Double: 2, Triple: 3, Quadruple: 4, Twin: 2, 'Twin/Double': 2 };
  const lodgingServices = trip.services.filter((s) => {
    const cat = (s.category || '').toLowerCase();
    return (cat.includes('hotel') || cat.includes('lodging') || cat.includes('accommodation')) && s.room_occupancy;
  });
  if (!lodgingServices.length) return null;
  const paxCount = trip.passengers.length;
  const issues = lodgingServices.map((s) => {
    const cap = OCCUPANCY_CAPACITY[s.room_occupancy] || 2;
    const qty = parseInt(s.quantity) || 1;
    const totalCap = cap * qty;
    return {
      name: s.name,
      occupancy: s.room_occupancy,
      capacity: cap,
      quantity: qty,
      totalCap,
      ok: totalCap >= paxCount,
    };
  });
  const allOk = issues.every((i) => i.ok);
  if (allOk) return null;
  return (
    <Card className="p-4 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 shadow-lg">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-300 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Occupancy Mismatch</p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            {paxCount} passenger{paxCount !== 1 ? 's' : ''} assigned, but some lodging services don't have enough room
            capacity:
          </p>
          <ul className="text-xs text-amber-700 dark:text-amber-300 mt-1 space-y-0.5 list-disc list-inside">
            {issues
              .filter((i) => !i.ok)
              .map((i, idx) => (
                <li key={idx}>
                  <strong>{i.name}</strong> — {i.occupancy} × {i.quantity} = {i.totalCap} pax capacity (needs {paxCount}
                  )
                </li>
              ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
