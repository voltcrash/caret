import { describe, expect, it, vi } from "vite-plus/test";
import {
  bindingName,
  consume,
  ROOT_LIMIT,
  tierFor,
} from "../../src/policies/rate-counter";
import { enforceLimit } from "../../src/policies/rate-limit";
import { withRuntime, type WorkerEnv } from "../../src/runtime/env";
import { GUEST } from "../../src/services/context";

function env(
  bindings: Record<string, { limit: (options: { key: string }) => unknown }>,
): WorkerEnv {
  return {
    DB: { withSession: () => ({}) },
    MODE: "production",
    ...bindings,
  } as unknown as WorkerEnv;
}

describe("Workers rate limiting budgets", () => {
  it.each([
    [
      { window: 5000, max: 1 },
      { period: 10, limit: 2 },
    ],
    [
      { window: 10_000, max: 3 },
      { period: 10, limit: 3 },
    ],
    [
      { window: "minute", max: 60 },
      { period: 60, limit: 60 },
    ],
    [ROOT_LIMIT, { period: 60, limit: 67 }],
    [
      { window: 30 * 60 * 1000, max: 50 },
      { period: 60, limit: 7 },
    ],
    [
      { window: "hour", max: 10 },
      { period: 60, limit: 1 },
    ],
    [
      { window: "day", max: 3 },
      { period: 60, limit: 1 },
    ],
    [
      { window: "hour", max: 1 },
      { period: 60, limit: 1 },
    ],
  ] as const)("maps %o to %o", (options, tier) => {
    expect(tierFor(options)).toEqual(tier);
  });

  it("never allows more in a minute than the whole window", () => {
    expect(tierFor({ window: "hour", max: 5 }).limit).toBeLessThanOrEqual(5);
  });

  it("counts keys on the matching binding", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const allowed = await withRuntime(
      env({ [bindingName({ period: 60, limit: 67 })]: { limit } }),
      async () => await consume("root:192.0.2.1", ROOT_LIMIT),
    );
    expect(allowed).toBe(false);
    expect(limit).toHaveBeenCalledWith({ key: "root:192.0.2.1" });
  });

  it("fails loudly when a deployment lacks a binding", async () => {
    await expect(
      withRuntime(env({}), async () => await consume("x", ROOT_LIMIT)),
    ).rejects.toThrow("RATE_LIMIT_60S_67");
  });

  it("rejects over-budget clients with a retry hint", async () => {
    const headers = new Map<string, string>();
    const limit = vi.fn(async () => ({ success: false }));
    await expect(
      withRuntime(
        env({ RATE_LIMIT_60S_67: { limit } }),
        async () =>
          await enforceLimit(
            "root",
            ROOT_LIMIT,
            { actor: GUEST, client: { ip: "2001:db8::1" } },
            (name, value) => headers.set(name, value),
            false,
          ),
      ),
    ).rejects.toThrow("root");
    expect(limit).toHaveBeenCalledWith({ key: "root:2001:db8::/56" });
    expect(headers.get("Retry-After")).toBe("60");
    expect(headers.get("X-RateLimit-Limit")).toBe("1000");
  });
});
