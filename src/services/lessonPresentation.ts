const readyPresentations = new Set<string>();
const readinessListeners = new Map<string, Set<(ready: boolean) => void>>();

export function beginLessonPresentation(lessonId: string) {
  readyPresentations.delete(lessonId);
}

export function markLessonPresentationReady(lessonId: string) {
  readyPresentations.add(lessonId);
  const listeners = readinessListeners.get(lessonId);
  if (!listeners) return;
  readinessListeners.delete(lessonId);
  listeners.forEach((listener) => listener(true));
}

export function waitForLessonPresentation(lessonId: string, timeoutMs = 1_800): Promise<boolean> {
  if (readyPresentations.has(lessonId)) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    const settle = (ready: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const listeners = readinessListeners.get(lessonId);
      listeners?.delete(settle);
      if (listeners?.size === 0) readinessListeners.delete(lessonId);
      resolve(ready);
    };
    const timeout = setTimeout(() => settle(false), timeoutMs);
    const listeners = readinessListeners.get(lessonId) ?? new Set<(ready: boolean) => void>();
    listeners.add(settle);
    readinessListeners.set(lessonId, listeners);
  });
}

export function forgetLessonPresentation(lessonId: string) {
  readyPresentations.delete(lessonId);
  const listeners = readinessListeners.get(lessonId);
  readinessListeners.delete(lessonId);
  listeners?.forEach((listener) => listener(false));
}
