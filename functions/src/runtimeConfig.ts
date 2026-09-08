import type { Firestore } from 'firebase-admin/firestore';

const CONFIG_CACHE_MS = 15_000;
const DEFAULT_GLOBAL_DAILY_LIMIT = 300;
const MAX_CONFIGURED_GLOBAL_DAILY_LIMIT = 1000;

export type AIRuntimeConfig = {
  enabled: boolean;
  maxDailyRequests: number;
};

let cached: { value: AIRuntimeConfig; expiresAt: number } | null = null;

export function normalizeAIRuntimeConfig(value: unknown): AIRuntimeConfig {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const configuredLimit = typeof data.maxDailyRequests === 'number' && Number.isInteger(data.maxDailyRequests)
    ? data.maxDailyRequests
    : DEFAULT_GLOBAL_DAILY_LIMIT;
  return {
    enabled: data.enabled !== false,
    maxDailyRequests: Math.max(1, Math.min(configuredLimit, MAX_CONFIGURED_GLOBAL_DAILY_LIMIT)),
  };
}

/**
 * Private operational settings. `_runtimeConfig/ai` may contain:
 * - `enabled=false` to pause new analyses in at most 15 seconds;
 * - `maxDailyRequests` (1..1000) to cap non-refundable daily provider attempts,
 *   including retries and repairs, in the Europe/Bucharest quota day.
 * Existing `_commercialGlobal` documents without providerBudgetVersion=2
 * cannot attest their previous cost. They fail closed for that quota day.
 * Security Rules deny all client access to this document.
 */
export async function getAIAnalysisConfig(db: Firestore, now = Date.now()): Promise<AIRuntimeConfig> {
  if (cached && cached.expiresAt > now) return cached.value;

  try {
    const snapshot = await db.collection('_runtimeConfig').doc('ai').get();
    const value = normalizeAIRuntimeConfig(snapshot.data());
    cached = { value, expiresAt: now + CONFIG_CACHE_MS };
    return value;
  } catch {
    // A failed control-plane read cannot be interpreted as permission to
    // bypass an operator's kill switch. Do not cache the failure.
    return { ...normalizeAIRuntimeConfig(undefined), enabled: false };
  }
}
