const TERMINAL_AUTH_CODES = new Set([
  'auth/id-token-revoked',
  'auth/invalid-user-token',
  'auth/session-cookie-revoked',
  'auth/user-disabled',
  'auth/user-not-found',
  'auth/user-token-expired',
]);

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code.toLocaleLowerCase('en-US') : null;
}

/**
 * Only terminal identity failures may rotate a Firebase user. Connectivity,
 * App Check and transient backend failures must preserve the current session.
 */
export function isTerminalAuthSessionError(error: unknown): boolean {
  const code = errorCode(error);
  return code !== null && TERMINAL_AUTH_CODES.has(code);
}

export function isUnauthenticatedCallableError(error: unknown): boolean {
  return errorCode(error) === 'functions/unauthenticated';
}
