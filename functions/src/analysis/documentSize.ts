const FIRESTORE_DOCUMENT_LIMIT_BYTES = 1_048_576;
// Field names, timestamps and Firestore encoding add overhead beyond JSON.
// Keeping roughly 20% headroom avoids relying on an imprecise byte estimate.
export const MAX_ANALYSIS_JSON_BYTES = 840_000;

export function assertFirestoreSafeAnalysis(value: unknown): void {
  const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  if (bytes <= MAX_ANALYSIS_JSON_BYTES) return;

  throw new Error(
    `Rendered analysis is too large for Firestore (${bytes}/${FIRESTORE_DOCUMENT_LIMIT_BYTES} bytes).`,
  );
}
