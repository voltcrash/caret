export type Cancelable<Args extends unknown[]> = ((...args: Args) => void) & {
  /**
   * Clears any pending call. Without `upcomingOnly`, later calls are ignored too.
   */
  cancel: (options?: { upcomingOnly?: boolean }) => void;
};

function schedule<Args extends unknown[]>(
  delay: number,
  callback: (...args: Args) => unknown,
  leading: boolean,
): Cancelable<Args> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let lastExec = 0;
  let cancelled = false;

  const clear = (): void => {
    if (timeout !== undefined) clearTimeout(timeout);
    timeout = undefined;
  };

  const wrapper = (...args: Args): void => {
    if (cancelled) return;
    const exec = (): void => {
      timeout = undefined;
      lastExec = Date.now();
      void callback(...args);
    };
    const elapsed = Date.now() - lastExec;
    clear();
    if (leading && elapsed > delay) {
      exec();
    } else {
      timeout = setTimeout(exec, leading ? delay - elapsed : delay);
    }
  };

  wrapper.cancel = (options?: { upcomingOnly?: boolean }): void => {
    clear();
    cancelled = options?.upcomingOnly !== true;
  };

  return wrapper;
}

/**
 * Calls `callback` with the latest arguments once `delay` ms pass without another call.
 */
export function debounce<Args extends unknown[]>(
  delay: number,
  callback: (...args: Args) => unknown,
): Cancelable<Args> {
  return schedule(delay, callback, false);
}

/**
 * Calls `callback` at most once per `delay` ms, on the leading edge and with the
 * latest arguments on the trailing edge.
 */
export function throttle<Args extends unknown[]>(
  delay: number,
  callback: (...args: Args) => unknown,
): Cancelable<Args> {
  return schedule(delay, callback, true);
}
