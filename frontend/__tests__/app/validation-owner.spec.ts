import { expect, it, vi } from "vite-plus/test";
import { useInputValidation } from "../../src/ts/hooks/useInputValidation";

it("cancels queued validation and ignores late validation after owner disposal", async () => {
  vi.useFakeTimers();
  try {
    const lifetime = new AbortController();
    const callback = vi.fn();
    let finish!: (value: true) => void;
    const valid = vi.fn(
      async () =>
        new Promise<true>((resolve) => {
          finish = resolve;
        }),
    );
    const handler = useInputValidation(
      callback,
      { isValid: valid, debounceDelay: 50 },
      undefined,
      lifetime.signal,
    );
    const input = document.createElement("input");
    input.value = "test";
    const event = { target: input } as unknown as Event;
    await handler(event);
    await vi.advanceTimersByTimeAsync(50);
    expect(valid).toHaveBeenCalledOnce();
    lifetime.abort();
    callback.mockClear();
    finish(true);
    await vi.runAllTimersAsync();
    expect(callback).not.toHaveBeenCalled();
    const queued = new AbortController();
    const next = useInputValidation(
      callback,
      { isValid: valid, debounceDelay: 50 },
      undefined,
      queued.signal,
    );
    await next(event);
    queued.abort();
    await vi.runAllTimersAsync();
    expect(valid).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});
