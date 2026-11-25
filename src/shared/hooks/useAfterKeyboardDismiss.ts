import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Dismisses the soft keyboard and invokes `action` only after the IME has
 * finished hiding (plus one layout frame so `keyboardInset` settles to `0`).
 * Prevents Android IME close animations, flex viewport resizes, and heavy
 * result/step/sheet mounts from colliding on the same frame.
 *
 * When the keyboard is already hidden, executes `action` immediately.
 */
export function useAfterKeyboardDismiss(keyboardVisible: boolean) {
  const visibleRef = useRef(keyboardVisible);
  visibleRef.current = keyboardVisible;

  const cleanupRef = useRef<(() => void) | null>(null);

  const cancelPending = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  useEffect(() => cancelPending, [cancelPending]);

  const runAfterKeyboardDismiss = useCallback((action: () => void, fallbackMs = 340) => {
    cancelPending();
    if (!visibleRef.current) {
      action();
      return;
    }

    let settled = false;
    let frameId: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      sub.remove();
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (frameId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      cleanupRef.current = null;
      if (typeof requestAnimationFrame === 'function') {
        frameId = requestAnimationFrame(() => {
          frameId = null;
          action();
        });
      } else {
        action();
      }
    };

    const eventName = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const sub = Keyboard.addListener(eventName, finish);
    timerId = setTimeout(finish, fallbackMs);
    cleanupRef.current = () => {
      settled = true;
      cleanup();
    };

    Keyboard.dismiss();
  }, [cancelPending]);

  return { runAfterKeyboardDismiss, cancelPending };
}
