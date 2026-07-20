import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/I18nContext';

export default function AddProviderDialog({ open, onOpenChange, newProvider, setNewProvider, createSupplierMutation }) {
  const { t: _t } = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{_t('createReservation.add')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createSupplierMutation.mutate(newProvider);
          }}
          className="space-y-4 mt-2"
        >
          <div className="space-y-2">
            <Label>{_t('createReservation.provider')}</Label>
            <Input
              value={newProvider.name}
              onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
              placeholder={_t('createReservation.e')}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{_t('createReservation.city')}</Label>
              <Input
                value={newProvider.city}
                onChange={(e) => setNewProvider({ ...newProvider, city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{_t('createReservation.phone')}</Label>
              <Input
                value={newProvider.phone}
                onChange={(e) => setNewProvider({ ...newProvider, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{_t('createReservation.email')}</Label>
            <Input
              type="email"
              value={newProvider.email}
              onChange={(e) => setNewProvider({ ...newProvider, email: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {_t('createReservation.cancel')}
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={createSupplierMutation.isPending}>
              {createSupplierMutation.isPending ? 'Adding...' : 'Add Provider'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
