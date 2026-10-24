import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { debounce, throttle } from "../src/timing";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("debounce", () => {
  it("calls once with the latest arguments after the quiet period", () => {
    const fn = vi.fn();
    const debounced = debounce(100, fn);
    debounced(1);
    vi.advanceTimersByTime(50);
    debounced(2);
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith(2);
  });

  it("stops for good on cancel()", () => {
    const fn = vi.fn();
    const debounced = debounce(100, fn);
    debounced();
    debounced.cancel();
    debounced();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it("keeps working after cancel({ upcomingOnly: true })", () => {
    const fn = vi.fn();
    const debounced = debounce(100, fn);
    debounced(1);
    debounced.cancel({ upcomingOnly: true });
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
    debounced(2);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledExactlyOnceWith(2);
  });
});

describe("throttle", () => {
  it("runs on the leading edge and once more on the trailing edge", () => {
    const fn = vi.fn();
    const throttled = throttle(100, fn);
    vi.advanceTimersByTime(1000);
    throttled(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith(1);
    throttled(2);
    throttled(3);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(3);
  });
});
