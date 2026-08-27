export type DiagnosticContext =
  | 'analysis_request'
  | 'app_render'
  | 'camera_mount'
  | 'commercial_access'
  | 'startup_bootstrap'
  | 'startup_assets'
  | 'commercial_initialization'
  | 'commercial_preflight'
  | 'data_deletion'
  | 'feedback_submission'
  | 'firebase_initialization'
  | 'google_disconnect'
  | 'notebook_prewarm'
  | 'notebook_update'
  | 'notebook_subscription';

function safeCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return 'unclassified';
  const code = String((error as { code?: unknown }).code ?? '').toLocaleLowerCase('en-US');
  return /^[a-z0-9/_-]{1,64}$/.test(code) ? code : 'unclassified';
}

/**
 * Produces a useful stack trace without copying an upstream error message,
 * photographed content, a Firebase UID or a local image URI into Crashlytics.
 */
export function createSafeDiagnosticError(context: DiagnosticContext, error: unknown): Error {
  const report = new Error(`${context}:${safeCode(error)}`);
  report.name = 'ProfuDiagnostic';

  if (error instanceof Error && typeof error.stack === 'string') {
    const frames = error.stack.split('\n').slice(1, 16);
    if (frames.length > 0) report.stack = [`${report.name}: ${report.message}`, ...frames].join('\n');
  }

  return report;
}
