import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Inbox, Plus } from 'lucide-react';

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description = '',
  actionLabel,
  onAction,
  className,
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4', className)}>
      <div className="p-4 bg-m3-secondary-container rounded-full mb-4">
        <Icon className="w-10 h-10 text-m3-on-secondary-container" />
      </div>
      <h3 className="m3-title-large text-m3-on-surface mb-1">{title}</h3>
      {description && <p className="m3-body-medium text-m3-on-surface-variant text-center max-w-sm mb-6">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction}>
          <Plus className="w-4 h-4 mr-1" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
