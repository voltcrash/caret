import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { createTimerScheduler } from "../../src/features/typing/runtime/timer-scheduler";
beforeEach(() =>
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }),
);
afterEach(() => vi.useRealTimers());

it("replaces scheduled callbacks and stops synchronously when native clock ends", () => {
  const clock = {
    start: vi.fn(),
    stop: vi.fn(),
    advance: vi.fn((_now: number): number | null => 1000),
  };
  const scheduler = createTimerScheduler(clock);
  clock.advance
    .mockImplementationOnce(() => 1000)
    .mockImplementationOnce(() => {
      scheduler.stop();
      return null;
    });
  scheduler.start(performance.now());
  vi.advanceTimersByTime(500);
  scheduler.start(performance.now());
  vi.advanceTimersByTime(500);
  expect(clock.advance).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1500);
  expect(clock.advance).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(5000);
  expect(clock.advance).toHaveBeenCalledTimes(2);
});

it("schedules the next callback using the exact delay supplied by the native clock", () => {
  const clock = {
    start: vi.fn(),
    stop: vi.fn(),
    advance: vi.fn((_now: number): number | null => null),
  };
  clock.advance.mockReturnValueOnce(750);
  const scheduler = createTimerScheduler(clock);
  const now = vi.spyOn(performance, "now").mockReturnValue(0);
  scheduler.start(0);
  now.mockReturnValue(3250);
  vi.advanceTimersByTime(1000);
  expect(clock.advance).toHaveBeenCalledWith(3250);
  now.mockReturnValue(4000);
  vi.advanceTimersByTime(749);
  expect(clock.advance).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);
  expect(clock.advance).toHaveBeenLastCalledWith(4000);
  expect(vi.getTimerCount()).toBe(0);
  scheduler.stop();
  now.mockRestore();
});
