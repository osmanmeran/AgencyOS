import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Trash2, Star } from 'lucide-react';
import PassengerFieldsRow from '@/components/passengers/PassengerFieldsRow';
import { autoGenerateRooms, newPassenger } from './helpers';
import { useT } from '@/lib/i18n/I18nContext';

export default function RoomsPassengersCard({
  rooms,
  passengerCount,
  setPassengerCount,
  setRooms,
  removeRoom,
  setRoomOccupancy,
  updatePassenger,
  setContactInRoom,
  derivedPax,
  slotsValid,
}) {
  const { t: _t } = useT();
  return (
    <Card className="p-6 bg-card shadow-md">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600 dark:text-blue-300" />
          {_t('createReservation.rooms_2')}
        </h2>
        <div className="flex items-center flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">{_t('createReservation.rooms_2')}</Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => {
                  if (rooms.length <= 1) return;
                  setRooms((prev) => prev.slice(0, -1));
                }}
              >
                −
              </Button>
              <span className="w-10 text-center font-bold text-lg text-foreground">{rooms.length}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() =>
                  setRooms((prev) => {
                    const cap = 2;
                    const passengers = Array.from({ length: cap }, () => newPassenger());
                    return [...prev, { id: `room-${Date.now()}-${Math.random()}`, type: 'double', passengers }];
                  })
                }
              >
                +
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">
              {_t('createReservation.passengers')}
            </Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => {
                  const next = Math.max(1, passengerCount - 1);
                  setPassengerCount(next);
                  setRooms(autoGenerateRooms(next));
                }}
              >
                −
              </Button>
              <span className="w-10 text-center font-bold text-lg text-foreground">{passengerCount}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => {
                  const next = passengerCount + 1;
                  setPassengerCount(next);
                  setRooms(autoGenerateRooms(next));
                }}
              >
                +
              </Button>
            </div>
          </div>
        </div>
      </div>

      {passengerCount > 0 && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
            slotsValid
              ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
          }`}
        >
          {slotsValid
            ? `✓ ${passengerCount} passenger${passengerCount !== 1 ? 's' : ''} — ${rooms.length} room${rooms.length !== 1 ? 's' : ''}`
            : `⚠ ${derivedPax} slot${derivedPax !== 1 ? 's' : ''} across ${rooms.length} room${rooms.length !== 1 ? 's' : ''} — passenger count set to ${passengerCount}. Adjust rooms or occupancy to match.`}
        </div>
      )}

      <div className="space-y-4">
        {rooms.map((room, ri) => {
          const roomTotalSlots = room.passengers.length;
          return (
            <div key={room.id} className="border border-border rounded-lg bg-muted overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground text-sm">
                    {_t('createReservation.room')} {ri + 1}
                  </span>
                  <Select value={String(roomTotalSlots)} onValueChange={(v) => setRoomOccupancy(room.id, parseInt(v))}>
                    <SelectTrigger className="w-36 h-8 text-xs bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} {_t('createReservation.person')}
                          {n > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeRoom(room.id)}
                    className="h-7 text-red-500 dark:text-red-300 hover:text-red-700 dark:hover:text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {room.passengers.map((pax) => (
                  <PassengerFieldsRow
                    key={pax.id}
                    passenger={pax}
                    onChange={(updated) => updatePassenger(room.id, pax.id, updated)}
                    showContact
                    onSetContact={() => setContactInRoom(room.id, pax.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {rooms.some((r) => r.passengers.some((p) => p.is_contact)) && (
        <p className="text-xs text-green-600 dark:text-green-300 mt-3 flex items-center gap-1">
          <Star className="w-3 h-3" fill="currentColor" />
          {_t('createReservation.contact')}{' '}
          <strong>{rooms.flatMap((r) => r.passengers).find((p) => p.is_contact)?.name}</strong>
        </p>
      )}
    </Card>
  );
}
