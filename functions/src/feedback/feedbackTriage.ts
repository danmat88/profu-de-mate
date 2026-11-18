export type FeedbackCategory = 'wrong_answer' | 'unclear' | 'unsafe' | 'other';
export type FeedbackSeverity = 'low' | 'medium' | 'high';

export const FEEDBACK_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

export function feedbackSeverity(category: FeedbackCategory): FeedbackSeverity {
  if (category === 'unsafe') return 'high';
  if (category === 'wrong_answer') return 'medium';
  return 'low';
}

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return value === 'wrong_answer' || value === 'unclear' || value === 'unsafe' || value === 'other';
}
