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
 * - `maxDailyRequests` (1..1000) to cap aggregate daily provider calls.
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
    // Firestore is also required by request claiming and quota reservation.
    // The conservative default cap still applies if this optional read fails.
    return normalizeAIRuntimeConfig(undefined);
  }
}
