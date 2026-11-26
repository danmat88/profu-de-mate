import OpenAI from 'openai';

export const DEFAULT_OPENAI_MODEL = 'gpt-6-luna';

const MODEL_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/i;
const ALLOWED_OPENAI_HOSTS = new Set([
  'api.openai.com',
  'eu.api.openai.com',
  'us.api.openai.com',
]);

export type OpenAiRuntimeConfig = {
  model: string;
  baseURL?: string;
};

export function resolveOpenAiRuntimeConfig(
  env: Record<string, string | undefined> = process.env,
): OpenAiRuntimeConfig {
  const rawModel = env.PROFU_OPENAI_MODEL?.trim();
  const model = rawModel && MODEL_NAME_PATTERN.test(rawModel)
    ? rawModel
    : DEFAULT_OPENAI_MODEL;

  const rawBaseUrl = env.PROFU_OPENAI_BASE_URL?.trim();
  if (!rawBaseUrl) return { model };

  let parsed: URL;
  try {
    parsed = new URL(rawBaseUrl);
  } catch {
    throw new Error('PROFU_OPENAI_BASE_URL must be a valid HTTPS URL.');
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_OPENAI_HOSTS.has(parsed.hostname)) {
    throw new Error('PROFU_OPENAI_BASE_URL must target an official OpenAI HTTPS endpoint.');
  }

  return {
    model,
    baseURL: parsed.toString().replace(/\/+$/, ''),
  };
}

export function createOpenAiClient(
  apiKey: string,
  config: Pick<OpenAiRuntimeConfig, 'baseURL'> = resolveOpenAiRuntimeConfig(),
): OpenAI {
  return new OpenAI({
    apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    maxRetries: 0,
  });
}
