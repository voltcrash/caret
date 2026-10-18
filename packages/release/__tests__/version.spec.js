import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  compareReleaseTags,
  getDateVersion,
  getNextReleaseVersion,
  getReleaseMonth,
} from "../src/version.js";

describe("production release numbers", () => {
  afterEach(() => vi.useRealTimers());

  it("starts each UTC month at .01", () => {
    expect(getNextReleaseVersion([], new Date("2026-11-03T12:00:00Z"))).toBe(
      "v26.11.01",
    );
  });

  it("counts releases within the month, not the day of the month", () => {
    const november = new Date("2026-11-15T12:00:00Z");
    expect(getNextReleaseVersion(["v26.11.01"], november)).toBe("v26.11.02");
    expect(
      getNextReleaseVersion(["v26.11.01", "v26.11.02", "v26.11.03"], november),
    ).toBe("v26.11.04");
  });

  it("ignores other months, years and non-release tags", () => {
    const tags = ["v26.10.11", "v25.11.07", "v2026.11.05", "release-1"];
    expect(getNextReleaseVersion(tags, new Date("2026-11-01T00:00:00Z"))).toBe(
      "v26.11.01",
    );
  });

  it("follows the highest number even with gaps, and grows past 99", () => {
    const date = new Date("2026-10-20T00:00:00Z");
    expect(getNextReleaseVersion(["v26.10.01", "v26.10.05"], date)).toBe(
      "v26.10.06",
    );
    expect(getNextReleaseVersion(["v26.10.99"], date)).toBe("v26.10.100");
  });

  it.each([
    ["2026-10-31T23:59:59Z", "v26.10"],
    ["2026-11-01T00:00:00Z", "v26.11"],
    ["2026-11-01T00:30:00+05:30", "v26.10"],
    ["2027-01-01T00:00:00Z", "v27.01"],
  ])("uses the UTC month for %s", (date, month) => {
    expect(getReleaseMonth(new Date(date))).toBe(month);
  });

  it("orders tags numerically", () => {
    const tags = ["v26.10.100", "v26.11.01", "v26.10.09", "v26.10.10"];
    expect(tags.sort(compareReleaseTags)).toEqual([
      "v26.10.09",
      "v26.10.10",
      "v26.10.100",
      "v26.11.01",
    ]);
    expect(() => compareReleaseTags("v26.10.01", "main")).toThrow();
  });
});

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
