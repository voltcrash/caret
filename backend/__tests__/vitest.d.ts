import type { Assertion, AsymmetricMatchersContaining } from "vite-plus/test";
import type { Test as SuperTest } from "supertest";
import MonkeyError from "../src/utils/error";

type ExpectedRateLimit = {
  /** max calls */
  max: number;
  /** window in milliseconds; documents the contract, not asserted */
  windowMs: number;
};
interface RestRequestMatcher<R = Supertest> {
  toBeRateLimited: (
    expected: ExpectedRateLimit,
  ) => Promise<RestRequestMatcher<R>>;
}
interface ThrowMatcher<R = MatcherResult> {
  toMatchMonkeyError: (expected: { status: number; message: string }) => R;
}

declare module "vitest" {
  interface Assertion<R extends void | Promise<void> = void, T = unknown>
    extends RestRequestMatcher<T>, ThrowMatcher<R> {}
  interface AsymmetricMatchersContaining
    extends RestRequestMatcher, ThrowMatcher {}
}

interface MatcherResult {
  pass: boolean;
  message: () => string;
  actual?: unknown;
  expected?: unknown;
}
