export type StartupTaskOutcome = 'ready' | 'failed' | 'timed_out';

export type StartupTaskResult<T> = {
  value: T;
  outcome: StartupTaskOutcome;
  error?: unknown;
};

/**
 * Settles a startup dependency inside a strict deadline. Startup dependencies
 * are local optimizations, not authorities: a slow cache, asset decode or
 * recovery marker must never trap the user behind the native splash.
 */
export function settleStartupTask<T>(
  task: Promise<T>,
  fallback: T,
  timeoutMs: number,
): Promise<StartupTaskResult<T>> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: StartupTaskResult<T>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(
      () => finish({ value: fallback, outcome: 'timed_out' }),
      timeoutMs,
    );

    task.then(
      (value) => finish({ value, outcome: 'ready' }),
      (error) => finish({ value: fallback, outcome: 'failed', error }),
    );
  });
}
