import { expect } from "vite-plus/test";
import ApiError from "../../src/utils/error";
import { MatcherResult } from "../vitest";

export function enableApiErrorExpects(): void {
  expect.extend({
    toMatchApiError(received: ApiError, expected: ApiError): MatcherResult {
      return {
        pass:
          received.status === expected.status &&
          received.message === expected.message,
        message: () => "ApiError does not match:",
        actual: { status: received.status, message: received.message },
        expected: { status: expected.status, message: expected.message },
      };
    },
  });
}
