import { useEffect, useRef, useState } from 'react';

// Tracks whether `value` has changed since the initial snapshot.
//
// Pass `resetKey` for pages that populate form state asynchronously after
// mount (e.g. loading an existing record to edit, or applying defaults from
// settings once they load) — when resetKey changes, the snapshot rebaselines
// instead of the auto-population being flagged as a user edit.
export function useDirtyState(value, resetKey) {
  const initialRef = useRef(JSON.stringify(value));
  const resetKeyRef = useRef(resetKey);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (resetKey !== resetKeyRef.current) {
      resetKeyRef.current = resetKey;
      initialRef.current = JSON.stringify(value);
      setIsDirty(false);
      return;
    }
    setIsDirty(JSON.stringify(value) !== initialRef.current);
  });

  return isDirty;
}
