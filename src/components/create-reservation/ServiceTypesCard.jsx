import { Card } from '@/components/ui/card';
import { Zap } from 'lucide-react';
import { SERVICE_TYPES, SERVICE_TYPE_ICONS } from './helpers';
import { useT } from '@/lib/i18n/I18nContext';

export default function ServiceTypesCard({ serviceTypes, setServiceTypes }) {
  const { t: _t } = useT();
  return (
    <Card className="p-6 bg-card shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-600 dark:text-purple-300" />
          {_t('createReservation.service')}
        </h2>
        <span className="text-sm text-muted-foreground">
          {serviceTypes.length} {_t('createReservation.selected')}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SERVICE_TYPES.map((st) => {
          const Icon = SERVICE_TYPE_ICONS[st.key];
          const selected = serviceTypes.includes(st.key);
          return (
            <button
              key={st.key}
              type="button"
              onClick={() =>
                setServiceTypes((prev) =>
                  prev.includes(st.key) ? prev.filter((k) => k !== st.key) : [...prev, st.key],
                )
              }
              className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                selected
                  ? 'border-purple-400 bg-purple-50 dark:bg-purple-950/40 shadow-sm'
                  : 'border-border bg-card hover:border-border'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${selected ? 'bg-purple-200 text-purple-700 dark:text-purple-300' : 'bg-muted text-muted-foreground'}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={`font-medium text-sm ${selected ? 'text-purple-900 dark:text-purple-300' : 'text-foreground'}`}
              >
                {st.label}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
