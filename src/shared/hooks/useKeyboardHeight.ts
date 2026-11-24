import { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from 'react-native';

export type KeyboardState = {
  /** Raw on-screen soft keyboard height in logical dp (0 when hidden). */
  keyboardHeight: number;
  /**
   * Exact bottom inset to apply to a full-screen `flex: 1` container so pinned
   * action bars sit cleanly above the keyboard without double-padding on
   * `adjustResize` devices or under-padding on Android 15/16 edge-to-edge.
   */
  keyboardInset: number;
  /** True while the soft keyboard is visibly open. */
  keyboardVisible: boolean;
};

/**
 * Reliable cross-API Android & iOS soft keyboard observer. Works cleanly on
 * Android 15/16 edge-to-edge (API 35/36) where `KeyboardAvoidingView` alone
 * leaves buttons hidden behind the soft keyboard.
 */
export function useKeyboardHeight(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({
    keyboardHeight: 0,
    keyboardInset: 0,
    keyboardVisible: false,
  });

  const baselineHeightRef = useRef(Dimensions.get('window').height);
  const rawHeightRef = useRef(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const updateForKeyboard = (rawMeasured: number) => {
      const windowH = Dimensions.get('window').height;
      const safeRaw = Math.max(0, Math.min(Math.round(windowH * 0.65), Math.round(rawMeasured)));
      rawHeightRef.current = safeRaw;
      if (safeRaw === 0) {
        baselineHeightRef.current = windowH;
        setState({ keyboardHeight: 0, keyboardInset: 0, keyboardVisible: false });
        return;
      }
      const windowShrankBy = Math.max(0, Math.round(baselineHeightRef.current - windowH));
      const inset = Math.max(0, safeRaw - windowShrankBy);
      setState({
        keyboardHeight: safeRaw,
        keyboardInset: inset,
        keyboardVisible: true,
      });
    };

    const onShow = (event: KeyboardEvent) => {
      const windowH = Dimensions.get('window').height;
      const endHeight = Math.max(0, Math.round(event.endCoordinates?.height ?? 0));
      const endScreenY = event.endCoordinates?.screenY;
      const overlapFromScreenY =
        typeof endScreenY === 'number' && endScreenY > 0 && endScreenY < windowH
          ? Math.round(windowH - endScreenY)
          : 0;
      updateForKeyboard(Math.max(endHeight, overlapFromScreenY));
    };

    const onHide = () => {
      updateForKeyboard(0);
    };

    const dimSub = Dimensions.addEventListener('change', ({ window }) => {
      if (rawHeightRef.current === 0) {
        baselineHeightRef.current = window.height;
      } else {
        const windowShrankBy = Math.max(0, Math.round(baselineHeightRef.current - window.height));
        const inset = Math.max(0, rawHeightRef.current - windowShrankBy);
        setState((prev) => (prev.keyboardInset === inset ? prev : { ...prev, keyboardInset: inset }));
      }
    });

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
      dimSub.remove();
    };
  }, []);

  return state;
}
