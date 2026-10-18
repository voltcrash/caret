import { createTestTimer, type TimerTick } from "@oxytype/typing-core/timer";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { createTimerScheduler } from "../../src/features/typing/runtime/timer-scheduler";
beforeEach(() =>
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }),
);
afterEach(() => vi.useRealTimers());

it("keeps one clock across restarts and stops synchronously when a test finishes", () => {
  const ticks: number[] = [];
  const clock = createTestTimer({
    onTick: ({ timer }) => {
      ticks.push(timer);
      if (timer === 2) scheduler.stop();
    },
  });
  const scheduler = createTimerScheduler(clock);
  scheduler.start(performance.now());
  vi.advanceTimersByTime(500);
  scheduler.start(performance.now());
  vi.advanceTimersByTime(500);
  expect(ticks).toEqual([]);
  vi.advanceTimersByTime(1500);
  expect(ticks).toEqual([1, 2]);
  expect(clock.isRunning()).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(5000);
  expect(ticks).toEqual([1, 2]);
});

it("catches up a delayed callback and schedules the next anchored second", () => {
  const tick = vi.fn<(value: TimerTick) => void>();
  const clock = createTestTimer({ onTick: tick });
  const scheduler = createTimerScheduler(clock);
  const now = vi.spyOn(performance, "now").mockReturnValue(0);
  scheduler.start(0);
  now.mockReturnValue(3250);
  vi.advanceTimersByTime(1000);
  expect(tick.mock.calls.map(([value]) => value.timer)).toEqual([1, 2, 3]);
  expect(tick.mock.calls[0]?.[0]).toMatchObject({ catchup: true });
  now.mockReturnValue(4000);
  vi.advanceTimersByTime(749);
  expect(tick).toHaveBeenCalledTimes(3);
  vi.advanceTimersByTime(1);
  expect(tick.mock.calls[3]?.[0]).toMatchObject({ timer: 4, drift: 0 });
  scheduler.stop();
  now.mockRestore();
});
