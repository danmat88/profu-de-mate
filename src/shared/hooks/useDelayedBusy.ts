import { useEffect, useState } from 'react';

/** Avoid flashing progress indicators for work that finishes within a frame or two. */
export function useDelayedBusy(busy: boolean, delay = 250) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!busy) { setVisible(false); return; }
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [busy, delay]);
  return busy && visible;
}
