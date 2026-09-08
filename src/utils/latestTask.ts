export type TaskState<T> =
  | { status: 'loading' }
  | { status: 'ready'; value: T }
  | { status: 'error'; error: unknown };

/** Bounds the wait, not the underlying native operation. Its eventual rejection is consumed. */
export function withDeadline<T>(operation: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds);
    operation.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** A timed-out, superseded or unmounted request must never publish a late result. */
export function createLatestTask<T>(
  operation: () => Promise<T>,
  publish: (state: TaskState<T>) => void,
  milliseconds: number,
  timeoutMessage: string,
) {
  let revision = 0;
  return {
    async run() {
      const current = ++revision;
      publish({ status: 'loading' });
      try {
        const value = await withDeadline(Promise.resolve().then(operation), milliseconds, timeoutMessage);
        if (current === revision) publish({ status: 'ready', value });
      } catch (error) {
        if (current === revision) publish({ status: 'error', error });
      }
    },
    cancel() { revision += 1; },
  };
}
