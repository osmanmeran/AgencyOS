import { format } from 'date-fns';
import { Calendar, MapPin, Building, ArrowRightLeft, User, Coffee, Plane, Map, Zap, Sun } from 'lucide-react';

const CATEGORY_MAP = {
  lodging: {
    label: 'Lodging',
    icon: Building,
    color: 'bg-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  transfers: {
    label: 'Transfer',
    icon: ArrowRightLeft,
    color: 'bg-green-500',
    bg: 'bg-green-50 dark:bg-green-950/40',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
  },
  guides: {
    label: 'Guide',
    icon: User,
    color: 'bg-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  restaurants: {
    label: 'Restaurant',
    icon: Coffee,
    color: 'bg-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
  },
  transportation: {
    label: 'Transport',
    icon: Plane,
    color: 'bg-indigo-500',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
  },
  guided_tours: {
    label: 'Guided Tour',
    icon: Map,
    color: 'bg-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
  },
  extra_activities: {
    label: 'Activity',
    icon: Zap,
    color: 'bg-pink-500',
    bg: 'bg-pink-50 dark:bg-pink-950/40',
    text: 'text-pink-700 dark:text-pink-300',
    border: 'border-pink-200 dark:border-pink-800',
  },
};

const detectCategory = (cat) => {
  const key = (cat || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '_')
    .replace(/^hotel$|^lodging$|^accommodation$|^resort$/, 'lodging')
    .replace(/^transfer/, 'transfers')
    .replace(/^tour$|^guide$|^excursion$|^activity$/, 'guided_tours');
  return (
    CATEGORY_MAP[key] || {
      label: cat || 'Service',
      icon: Sun,
      color: 'bg-slate-500',
      bg: 'bg-muted',
      text: 'text-foreground',
      border: 'border-border',
    }
  );
};

export function ServiceCard({ service }) {
  const cfg = detectCategory(service.category);
  const Icon = cfg.icon;
  const hasTimes =
    service.pickup_time || service.transfer_flight_number || (!service._isReturnLeg && service.return_leg?.enabled);

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${cfg.color} text-white`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold text-foreground">{service.name}</h4>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                  {cfg.label}
                </span>
                {service._isReturnLeg && (
                  <span className="inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                    Return
                  </span>
                )}
              </div>
            </div>
          </div>

          {service.location && (
            <div className="flex items-center gap-1 text-muted-foreground text-sm mt-2">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{service.location}</span>
            </div>
          )}

          {service.pickup_location && (
            <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="font-medium text-muted-foreground">Pick up:</span>
                <span>{service.pickup_location}</span>
                {service.pickup_time && <span className="text-muted-foreground">@ {service.pickup_time}</span>}
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium text-muted-foreground">Drop off:</span>
                <span>{service.dropoff_location || '—'}</span>
              </div>
              {service.transfer_flight_number && (
                <div className="flex items-center gap-1">
                  <span className="font-medium text-muted-foreground">Flight:</span>
                  <span>{service.transfer_flight_number}</span>
                </div>
              )}
              {!service._isReturnLeg && service.return_leg?.enabled && (
                <div className="mt-1.5 pt-1.5 border-t border-orange-200 dark:border-orange-800">
                  <div className="text-xs font-medium text-orange-600 dark:text-orange-300">Return Leg</div>
                  <div>
                    <span className="font-medium text-muted-foreground">Date:</span>{' '}
                    {format(new Date(service.return_leg.date), 'MMM d, yyyy')}
                    {service.return_leg.pickup_time ? ` @ ${service.return_leg.pickup_time}` : ''}
                  </div>
                </div>
              )}
            </div>
          )}

          {hasTimes && service.start_date && service.end_date && !service.pickup_location && (
            <div className="flex items-center gap-1 text-muted-foreground text-sm mt-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {format(new Date(service.start_date), 'MMM d')} – {format(new Date(service.end_date), 'MMM d, yyyy')}
              </span>
            </div>
          )}

          {service.description && (
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">{service.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function DaySection({ date, services, dayIndex }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex flex-col items-center bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl px-5 py-2.5 shadow-md min-w-[90px]">
          <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">Day {dayIndex + 1}</span>
          <span className="text-sm font-bold">{format(new Date(date), 'EEE, MMM d')}</span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
      </div>
      <div className="space-y-3 ml-1">
        {services.map((svc, idx) => (
          <ServiceCard key={idx} service={svc} />
        ))}
      </div>
    </div>
  );
}
