import { expect } from "vite-plus/test";
import { REQUEST_MULTIPLIER } from "../../src/policies/rate-limit";
import { MatcherResult, ExpectedRateLimit } from "../vitest";
import type { TestRequest } from "./test-client";

export function enableRateLimitExpects(): void {
  expect.extend({
    toBeRateLimited: async (
      received: TestRequest,
      expected: ExpectedRateLimit,
    ): Promise<MatcherResult> => {
      const { headers } = await received.expect(200);

      // Workers rate limiting reports no reset time; the budget derives from
      // the window, which `rate-counter` tests cover.
      const max =
        parseInt(headers["x-ratelimit-limit"] as string) / REQUEST_MULTIPLIER;

      return {
        pass: max === expected.max,
        message: () => "Rate limit max not matching",
        actual: { max },
        expected: { max: expected.max },
      };
    },
  });
}
