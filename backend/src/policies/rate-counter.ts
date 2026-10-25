import {
  limits,
  type RateLimitOptions,
} from "@oxytype/contracts/rate-limit/index";
import { runtime } from "../runtime/env";

/**
 * Workers rate limiting: per-location, eventually consistent, no D1 writes.
 * Bindings support only 10s/60s periods and a fixed limit, so each distinct
 * budget is one binding; limits sharing a budget are separated by key.
 */
export type RateTier = { period: 10 | 60; limit: number };

/**
 * Windows above a minute become a per-minute budget of this many times their
 * average rate, but never below `MIN_BURST` (or the window's whole max): the
 * D1 limiter allowed a window's budget at once, and a signed-in page load
 * reads several low-volume operations together.
 */
export const BURST = 4;
export const MIN_BURST = 30;

const WINDOWS = { second: 1000, minute: 60000, hour: 3600000, day: 86400000 };

export function windowMs(options: RateLimitOptions): number {
  return typeof options.window === "number"
    ? options.window
    : WINDOWS[options.window];
}

export function tierFor(options: RateLimitOptions): RateTier {
  const window = windowMs(options);
  const period = window <= 10_000 ? 10 : 60;
  const scaled =
    window <= period * 1000
      ? (options.max * period * 1000) / window
      : Math.min(
          options.max,
          Math.max(MIN_BURST, (options.max * BURST * period * 1000) / window),
        );
  return { period, limit: Math.max(1, Math.ceil(scaled)) };
}

export function bindingName(tier: RateTier): `RATE_LIMIT_${string}` {
  return `RATE_LIMIT_${tier.period}S_${tier.limit}`;
}

/** Limits enforced outside the operation contracts. */
export const ROOT_LIMIT: RateLimitOptions = { window: "hour", max: 1000 };
export const SESSION_LIMIT: RateLimitOptions = { window: "minute", max: 60 };
/** Better Auth's former defaults: all auth routes, then credential routes. */
export const AUTH_LIMIT: RateLimitOptions = { window: 10_000, max: 100 };
export const AUTH_SIGN_IN_LIMIT: RateLimitOptions = { window: 10_000, max: 3 };

/** Every binding a deployment must declare; checked against Wrangler configs. */
export function requiredTiers(): RateTier[] {
  const all = [
    ROOT_LIMIT,
    SESSION_LIMIT,
    AUTH_LIMIT,
    AUTH_SIGN_IN_LIMIT,
    ...Object.values(limits),
  ].map(tierFor);
  return [...new Map(all.map((tier) => [bindingName(tier), tier])).values()];
}

/** Count one request; resolves false once the key is over its budget. */
export async function consume(
  key: string,
  options: RateLimitOptions,
): Promise<boolean> {
  const name = bindingName(tierFor(options));
  const limiter = runtime().env[name];
  if (limiter === undefined) {
    throw new Error(`Rate limit binding ${name} is not configured`);
  }
  return (await limiter.limit({ key })).success;
}
