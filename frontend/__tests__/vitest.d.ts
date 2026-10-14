// oxlint-disable typescript/consistent-type-definitions -- Vitest matcher augmentation requires interface declaration merging.
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import type { TestActivityDay } from "../src/ts/elements/test-activity-calendar";

interface ActivityDayMatchers<R = TestActivityDay> {
  toBeDate: (date: string) => ActivityDayMatchers<R>;
  toHaveTests: (tests: number) => ActivityDayMatchers<R>;
  toHaveLevel: (level?: string | number) => ActivityDayMatchers<R>;
  toBeFiller: () => ActivityDayMatchers<R>;
}

declare module "vitest" {
  interface Assertion<R extends void | Promise<void> = void, T = unknown>
    extends ActivityDayMatchers<T>, TestingLibraryMatchers<unknown, R> {}
  interface AsymmetricMatchersContaining
    extends ActivityDayMatchers, TestingLibraryMatchers<unknown, unknown> {}
}

interface MatcherResult {
  pass: boolean;
  message: () => string;
  actual?: unknown;
  expected?: unknown;
}
