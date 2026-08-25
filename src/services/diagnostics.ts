import { getApp } from '@react-native-firebase/app';
import { getCrashlytics, recordError } from '@react-native-firebase/crashlytics';
import { createSafeDiagnosticError, type DiagnosticContext } from '../utils/diagnostics';

export function recordDiagnosticError(context: DiagnosticContext, error: unknown): void {
  try {
    const crashlytics = getCrashlytics(getApp());
    if (!crashlytics.isCrashlyticsCollectionEnabled) return;
    recordError(crashlytics, createSafeDiagnosticError(context, error), context);
  } catch {
    // Diagnostics must never change the user's recovery path.
  }
}
