import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  d1ErrorMessage,
  isTransientD1Error,
  retryIdempotentD1Write,
} from "../../src/db/retry";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("D1 transient write retry", () => {
  it.each([
    "Network connection lost",
    "storage caused object to be reset",
    "reset because its code was updated",
  ])("recognizes wrapped %s", (message) => {
    expect(
      isTransientD1Error(
        new Error("Failed query", { cause: new Error(message) }),
      ),
    ).toBe(true);
  });

  it("bounds retries and uses exponential jitter", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const failure = new Error("Network connection lost");
    const write = vi.fn<() => Promise<void>>().mockRejectedValue(failure);
    const started = Date.now();
    const check = expect(retryIdempotentD1Write(write)).rejects.toBe(failure);
    await vi.runAllTimersAsync();
    await check;
    expect(write).toHaveBeenCalledTimes(4);
    expect(Date.now() - started).toBe(350);
  });

  it("returns after recovery without another replay", async () => {
    vi.useFakeTimers();
    const write = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error("Network connection lost"))
      .mockResolvedValue(42);
    const check = expect(retryIdempotentD1Write(write)).resolves.toBe(42);
    await vi.runAllTimersAsync();
    await check;
    expect(write).toHaveBeenCalledTimes(2);
  });

  it.each([
    "UNIQUE constraint failed",
    "mutation_version",
    "no such table",
    "SQLITE_BUSY",
    "D1 DB exceeded its storage limit",
    "overloaded",
  ])("does not retry %s", async (message) => {
    const write = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error(message));
    await expect(retryIdempotentD1Write(write)).rejects.toThrow(message);
    expect(write).toHaveBeenCalledOnce();
  });

  it("handles cyclic error causes without looping", () => {
    const error = new Error("Network connection lost");
    error.cause = error;
    expect(d1ErrorMessage(error)).toBe("Network connection lost");
  });
});
