import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';
import { format } from 'date-fns';

export default function HistoryModal({ historyOpen, setHistoryOpen, trip }) {
  return (
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Change History
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          {trip.change_history
            ?.slice()
            .reverse()
            .map((entry, idx) => (
              <div key={idx} className="p-4 bg-muted rounded-lg border">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {entry.action === 'created' && (
                    <Badge className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
                      Created
                    </Badge>
                  )}
                  {entry.action === 'status_change' && (
                    <Badge className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">Status</Badge>
                  )}
                  {entry.action === 'service_added' && (
                    <Badge className="bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300">
                      Service Added
                    </Badge>
                  )}
                  {entry.action === 'service_updated' && (
                    <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                      Service Updated
                    </Badge>
                  )}
                  {entry.action === 'email_sent' && (
                    <Badge className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300">
                      Email Sent
                    </Badge>
                  )}
                  {entry.action === 'invoice_created' && (
                    <Badge className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
                      Invoice Created
                    </Badge>
                  )}
                  {![
                    'created',
                    'status_change',
                    'service_added',
                    'service_updated',
                    'email_sent',
                    'invoice_created',
                  ].includes(entry.action) && <Badge variant="outline">{entry.action}</Badge>}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(entry.date), 'MMM d, yyyy HH:mm')}
                  </span>
                </div>
                <p className="text-sm text-foreground">{entry.description}</p>
                <div className="text-xs text-muted-foreground mt-1">By {entry.changed_by_name || entry.changed_by}</div>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
