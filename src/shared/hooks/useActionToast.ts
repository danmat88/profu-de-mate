import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionToastState } from '../ui/ActionToast';

type ShowToastInput = {
  message: string;
  tone?: ActionToastState['tone'];
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
};

/**
 * Manages a single auto-dismissing ActionToast with clean unmount cleanup.
 */
export function useActionToast() {
  const [toast, setToast] = useState<ActionToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback((input: ShowToastInput) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const id = ++seqRef.current;
    const wrappedAction = input.onAction
      ? () => {
        hideToast();
        input.onAction?.();
      }
      : undefined;

    setToast({
      id,
      message: input.message,
      tone: input.tone,
      actionLabel: input.actionLabel,
      onAction: wrappedAction,
    });

    const duration = input.durationMs ?? (input.actionLabel ? 3200 : 2100);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setToast((current) => (current?.id === id ? null : current));
    }, duration);
  }, [hideToast]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { toast, showToast, hideToast };
}
