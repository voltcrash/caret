import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  postgresError,
  isTransientDatabaseError,
  retryIdempotentWrite,
} from "../../src/db/retry";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PostgreSQL transient write retry", () => {
  it.each(["08006", "40001", "40P01", "57P01"])("recognizes wrapped PostgreSQL %s", (code) => {
    expect(isTransientDatabaseError(new Error("Failed query", { cause: Object.assign(new Error("unavailable"), { code }) }))).toBe(true);
  });

  it("bounds retries and uses exponential jitter", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const failure = new Error("Network connection lost");
    const write = vi.fn<() => Promise<void>>().mockRejectedValue(failure);
    const started = Date.now();
    const check = expect(retryIdempotentWrite(write)).rejects.toBe(failure);
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
    const check = expect(retryIdempotentWrite(write)).resolves.toBe(42);
    await vi.runAllTimersAsync();
    await check;
    expect(write).toHaveBeenCalledTimes(2);
  });

  it.each([
    "UNIQUE constraint failed",
    "mutation_version",
    "no such table",
    "SQLITE_BUSY",
    "PostgreSQL DB exceeded its storage limit",
    "overloaded",
  ])("does not retry %s", async (message) => {
    const write = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error(message));
    await expect(retryIdempotentWrite(write)).rejects.toThrow(message);
    expect(write).toHaveBeenCalledOnce();
  });

  it("handles cyclic error causes without looping", () => {
    const error = new Error("Network connection lost");
    error.cause = error;
    expect(postgresError(error)).toBeUndefined();
  });
});
