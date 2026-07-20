import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { useT } from '@/lib/i18n/I18nContext';

export default function PageHeader({ isEditing, showLibrary, setShowLibrary }) {
  const { t: _t } = useT();
  return (
    <>
      <Link to={createPageUrl('Reservations')}>
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          {_t('createReservation.back')}
        </Button>
      </Link>

      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{isEditing ? 'Edit Reservation' : 'New Reservation'}</h1>
          <p className="text-muted-foreground mt-1">
            {isEditing
              ? 'Update reservation details, services, and pricing'
              : 'Fill in details, add services, then send to client or confirm directly'}
          </p>
        </div>
        <Button
          type="button"
          variant={showLibrary ? 'default' : 'outline'}
          onClick={() => setShowLibrary((v) => !v)}
          className={showLibrary ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          <BookOpen className="w-4 h-4 mr-2" />
          {showLibrary ? 'Hide Library' : 'Service Library'}
        </Button>
      </div>
    </>
  );
}
