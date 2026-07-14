import { TIER_LABELS } from './helpers';

export default function TierCards({ users }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {Object.entries(TIER_LABELS).map(([tier, { label, color, description }]) => (
        <div key={tier} className="p-4 bg-card rounded-xl border border-border">
          <div className="flex justify-between items-center mb-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>{label}</span>
            <span className="text-2xl font-bold">{users.filter((u) => u.user_tier === tier).length}</span>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      ))}
    </div>
  );
}
