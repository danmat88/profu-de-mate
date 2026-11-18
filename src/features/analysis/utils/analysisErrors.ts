type CallableErrorLike = {
  code?: unknown;
  message?: unknown;
};

function normalizedError(error: unknown): { code: string; message: string } {
  const value = (error && typeof error === 'object' ? error : {}) as CallableErrorLike;
  return {
    code: typeof value.code === 'string' ? value.code.toLocaleLowerCase('en-US') : '',
    message: typeof value.message === 'string' ? value.message.toLocaleLowerCase('ro-RO') : '',
  };
}

export function friendlyAnalysisError(error: unknown): string {
  const { code, message } = normalizedError(error);

  if (message.includes('pauză tehnică')) {
    return 'Profu’ este într-o scurtă pauză tehnică. Încearcă din nou peste câteva minute.';
  }
  if (code.includes('app-check')) {
    return 'Nu am putut verifica această instalare. Închide complet aplicația, apoi deschide-o din nou.';
  }
  if (code.includes('resource-exhausted')) {
    return 'Ai ajuns la limita de analize pentru moment. Încearcă din nou mai târziu.';
  }
  if (code.includes('unauthenticated')) {
    return 'Sesiunea securizată nu a pornit. Închide aplicația, apoi deschide-o din nou.';
  }
  if (code.includes('permission-denied') || code.includes('unauthorized') || code.includes('failed-precondition')) {
    return 'Nu am putut verifica această instalare. Repornește aplicația și încearcă din nou.';
  }
  if (code.includes('invalid-argument')) {
    return 'Nu am putut citi fotografia. Fotografiază din nou problema completă, într-o lumină bună.';
  }
  if (code.includes('aborted') || code.includes('already-exists')) {
    return 'Fotografia este încă analizată. Așteaptă câteva secunde și încearcă din nou.';
  }
  if (code.includes('deadline-exceeded') || message.includes('timed out') || message.includes('timeout')) {
    return 'Analiza a durat prea mult. Fotografia a rămas numai pe telefon; încearcă din nou.';
  }
  if (
    code.includes('unavailable')
    || code.includes('network-request-failed')
    || message.includes('network request failed')
    || message.includes('failed to fetch')
  ) {
    return 'Nu te pot auzi fără internet. Verifică legătura și încearcă din nou. Fotografia rămâne pe telefon.';
  }
  if (code.includes('internal') || code.includes('unknown')) {
    return 'A apărut o problemă temporară. Încearcă din nou peste câteva momente.';
  }
  if (message.includes('file') || message.includes('no such')) {
    return 'Fotografia nu mai poate fi citită de pe telefon. Fă altă fotografie sau alege din nou imaginea.';
  }
  return 'Nu am putut analiza fotografia. Ea nu a fost salvată în Caiet. Încearcă din nou.';
}
