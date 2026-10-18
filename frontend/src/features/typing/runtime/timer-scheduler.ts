import type { TestTimer } from "@oxytype/typing-core/timer";

/** Schedule the wall-clock timer independently of cosmetic animation frames. */
export function createTimerScheduler(clock: TestTimer): {
  start: (now: number) => void;
  stop: () => void;
} {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const stop = (): void => {
    clock.stop();
    clearTimeout(timeout);
    timeout = undefined;
  };
  const schedule = (delay: number): void => {
    timeout = setTimeout(() => {
      timeout = undefined;
      const nextDelay = clock.advance(performance.now());
      if (nextDelay !== null) schedule(nextDelay);
    }, delay);
  };
  return {
    start(now) {
      stop();
      clock.start(now);
      schedule(Math.max(0, now + 1000 - performance.now()));
    },
    stop,
  };
}
