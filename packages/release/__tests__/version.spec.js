import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { getDateVersion } from "../src/version.js";

describe("terminal date versions", () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    ["2026-10-04T12:00:00Z", "v26.10.04"],
    ["2028-02-29T12:00:00Z", "v28.02.29"],
    ["2026-10-04T00:30:00+05:30", "v26.10.03"],
  ])("formats %s as %s", (date, expected) => {
    expect(getDateVersion(new Date(date))).toBe(expected);
  });

  it("uses the current date when no date is supplied", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
    expect(getDateVersion()).toBe("v26.10.04");
  });
});
