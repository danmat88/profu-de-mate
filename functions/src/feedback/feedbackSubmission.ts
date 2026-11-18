export const FEEDBACK_RATE_WINDOW_MS = 60 * 60 * 1000;
export const FEEDBACK_RATE_LIMIT = 8;

export type FeedbackRateState = {
  windowStartedAt: number;
  submissions: number;
};

export function nextFeedbackRateState(
  current: Partial<FeedbackRateState> | undefined,
  now = Date.now(),
): { allowed: boolean; state: FeedbackRateState } {
  const startedAt = typeof current?.windowStartedAt === 'number' && Number.isFinite(current.windowStartedAt)
    ? current.windowStartedAt
    : 0;
  const submissions = typeof current?.submissions === 'number' && Number.isFinite(current.submissions)
    ? Math.max(0, Math.floor(current.submissions))
    : 0;
  const activeWindow = startedAt > 0 && now - startedAt >= 0 && now - startedAt < FEEDBACK_RATE_WINDOW_MS;
  const state = activeWindow
    ? { windowStartedAt: startedAt, submissions: submissions + 1 }
    : { windowStartedAt: now, submissions: 1 };
  return { allowed: state.submissions <= FEEDBACK_RATE_LIMIT, state };
}
