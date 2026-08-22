import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { mathAnalysisJsonSchema, mathAnalysisSchema } from './analysisSchema.js';
import { buildPrompt } from './prompt.js';
import { renderMathAnalysis, type RenderedMathAnalysis } from './mathRenderer.js';
import { consumeAnalysisQuota } from './rateLimit.js';
import { parseAnalyzeRequest } from './validation.js';

initializeApp();

const db = getFirestore();
const geminiApiKey = defineSecret('GEMINI_API_KEY');

export const analyzeMathImage = onCall({
  region: 'europe-west1',
  memory: '512MiB',
  timeoutSeconds: 120,
  maxInstances: 3,
  concurrency: 10,
  enforceAppCheck: true,
  secrets: [geminiApiKey],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Trebuie să pornești aplicația din nou.');
  }

  const input = parseAnalyzeRequest(request.data);
  await consumeAnalysisQuota(db, request.auth.uid);

  try {
    const client = new GoogleGenAI({ apiKey: geminiApiKey.value() });
    let result: RenderedMathAnalysis | null = null;
    let lastValidationError: unknown = new Error('Gemini returned an empty response.');

    for (let attempt = 0; attempt < 2 && !result; attempt += 1) {
      const retryInstruction = attempt === 0
        ? ''
        : '\n\nValidarea răspunsului anterior a eșuat. Generează din nou toate câmpurile. Mută fiecare expresie matematică într-un bloc type="math" și verifică fiecare câmp latex ca LaTeX MathJax valid, fără delimitatori.';
      const interaction = await client.interactions.create({
        model: 'gemini-3.7-flash',
        input: [
          { type: 'text', text: `${buildPrompt(input.mode)}${retryInstruction}` },
          { type: 'image', data: input.imageBase64, mime_type: input.mimeType },
        ],
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: mathAnalysisJsonSchema,
        },
        generation_config: {
          thinking_level: 'low',
        },
      });

      try {
        if (!interaction.output_text) throw new Error('Gemini returned an empty response.');
        const candidate = mathAnalysisSchema.parse(JSON.parse(interaction.output_text));
        result = await renderMathAnalysis(candidate);
      } catch (error) {
        lastValidationError = error;
        logger.warn('Structured math response rejected', { attempt: attempt + 1, mode: input.mode });
      }
    }

    if (!result) throw lastValidationError;
    const lessonRef = result.status === 'ready'
      ? db.collection('users').doc(request.auth.uid).collection('lessons').doc()
      : null;

    if (lessonRef) {
      await lessonRef.set({
        ...result,
        model: 'gemini-3.7-flash',
        isFavorite: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    logger.info('Math image analyzed', {
      status: result.status,
      mode: result.mode,
      stored: Boolean(lessonRef),
    });

    return { lessonId: lessonRef?.id ?? null, result };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error('Math analysis failed', { error });
    throw new HttpsError('internal', 'Nu am putut analiza imaginea acum. Încearcă din nou.');
  }
});
