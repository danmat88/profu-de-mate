import * as NativeHaptics from 'expo-haptics';

export const ImpactFeedbackStyle = NativeHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = NativeHaptics.NotificationFeedbackType;

// Tactile feedback must never delay a photo, lock a setting, or turn a
// successful save/deletion into an error when the native vibration service fails.
function optionalFeedback(operation: () => Promise<void>): void {
  try { void operation().catch(() => undefined); } catch { /* Optional native feedback. */ }
}

export function selection(): void {
  optionalFeedback(() => NativeHaptics.selectionAsync());
}

export function impact(style: NativeHaptics.ImpactFeedbackStyle): void {
  optionalFeedback(() => NativeHaptics.impactAsync(style));
}

export function notification(type: NativeHaptics.NotificationFeedbackType): void {
  optionalFeedback(() => NativeHaptics.notificationAsync(type));
}
