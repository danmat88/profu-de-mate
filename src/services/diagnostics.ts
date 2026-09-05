import { getApp } from '@react-native-firebase/app';
import { getCrashlytics, recordError } from '@react-native-firebase/crashlytics';
import { createSafeDiagnosticError, type DiagnosticContext } from '../utils/diagnostics';

export function recordDiagnosticError(context: DiagnosticContext, error: unknown): void {
  const safeError = createSafeDiagnosticError(context, error);
  if (__DEV__) {
    // Development builds need an immediate, sanitized signal even when the
    // user has correctly left optional Crashlytics diagnostics disabled.
    console.warn(`[diagnostic:${context}]`, safeError);
  }
  try {
    const crashlytics = getCrashlytics(getApp());
    if (!crashlytics.isCrashlyticsCollectionEnabled) return;
    recordError(crashlytics, safeError, context);
  } catch {
    // Diagnostics must never change the user's recovery path.
  }
}
