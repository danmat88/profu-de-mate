function readErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  return String((error as { code?: unknown }).code ?? '').trim();
}

function readErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('message' in error)) return '';
  return String((error as { message?: unknown }).message ?? '').trim();
}

/**
 * Recognizes every cancellation signal that Android Credential Manager,
 * Nitro Google Sign-In, or Firebase Auth can emit when the user closes the
 * account picker without signing in.
 */
export function isGoogleSignInCancelledError(error: unknown): boolean {
  const code = readErrorCode(error).toLocaleUpperCase('en-US');
  if (
    code === 'SIGN_IN_CANCELLED'
    || code === '12501'
    || code === 'CANCELED'
    || code === 'CANCELLED'
    || code === 'AUTH/CANCELLED-POPUP-REQUEST'
    || code === 'AUTH/POPUP-CLOSED-BY-USER'
  ) {
    return true;
  }
  const message = readErrorMessage(error).toLocaleLowerCase('en-US');
  return message.includes('user canceled') || message.includes('user cancelled');
}

/**
 * Maps real Google Sign-In and Firebase linking failures to clear, accurate
 * Romanian messages without leaking technical SDK codes or misleading the user.
 */
export function friendlyGoogleConnectError(error: unknown): string {
  const code = readErrorCode(error);
  const upperCode = code.toLocaleUpperCase('en-US');

  if (upperCode === 'PLAY_SERVICES_NOT_AVAILABLE') {
    return 'Serviciile Google Play trebuie actualizate pe acest telefon. Actualizează-le din Google Play și încearcă din nou.';
  }
  if (upperCode === 'IN_PROGRESS') {
    return 'Conectarea cu Google este deja în curs. Așteaptă câteva secunde.';
  }
  if (upperCode === 'DEVELOPER_ERROR') {
    return 'Conectarea cu Google nu este disponibilă în această versiune. Încearcă din nou mai târziu.';
  }
  if (upperCode === 'ONE_TAP_START_FAILED' || upperCode === 'SIGN_IN_REQUIRED') {
    return 'Nu am găsit un cont Google disponibil pe telefon (conturile supravegheate prin Family Link pot bloca conectarea în aplicații). Poți folosi gratuit aplicația și fără conectare sau poți adăuga un cont eligibil în setările telefonului.';
  }
  if (code === 'auth/user-disabled') {
    return 'Acest cont Google este dezactivat și nu poate fi conectat.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Prea multe încercări într-un timp scurt. Așteaptă un minut și încearcă din nou.';
  }
  if (
    code === 'auth/network-request-failed'
    || code === 'functions/unavailable'
    || code === 'functions/deadline-exceeded'
    || code === 'app-check/not-ready'
  ) {
    return 'Conectarea nu a reușit. Verifică internetul și încearcă din nou.';
  }

  const message = readErrorMessage(error);
  if (
    message.startsWith('Mai multe conectări așteaptă')
    || message.startsWith('Conectarea cu Google nu este disponibilă')
    || message.startsWith('Conectarea sigură cu Google')
    || message.startsWith('Așteaptă finalizarea ștergerii')
  ) {
    return message;
  }

  return 'Conectarea cu Google nu s-a putut finaliza. Verifică internetul și încearcă din nou.';
}
