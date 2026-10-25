import type { Assertion, AsymmetricMatchersContaining } from "vite-plus/test";
import type { TestRequest } from "./__testData__/test-client";
import MonkeyError from "../src/utils/error";

type ExpectedRateLimit = {
  /** max calls */
  max: number;
  /** window in milliseconds. Needs to be within 2500ms */
  windowMs: number;
};
interface RestRequestMatcher<R = TestRequest> {
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
