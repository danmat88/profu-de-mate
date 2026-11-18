export function friendlyWrittenMathError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code.endsWith('/invalid-argument')) return 'Formula nu a fost acceptată. Verifică expresia și completează toate căsuțele înainte de a o retrimite.';
  if (code.endsWith('/unauthenticated') || code === 'session/changed') return 'Sesiunea s-a schimbat. Revino acasă și reia problema.';
  if (code.endsWith('/permission-denied') || code.includes('app-check')) return 'Nu am putut verifica instalarea. Repornește aplicația.';
  if (code.endsWith('/deadline-exceeded') || code.endsWith('/aborted')) return 'Analiza durează mai mult. La reîncercare verific mai întâi dacă rezultatul este deja pregătit.';
  return 'Nu am putut termina analiza acum. Verifică internetul și încearcă din nou. Problema este păstrată pe telefon.';
}
