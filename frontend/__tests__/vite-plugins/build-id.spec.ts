import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import { resolveBuildId, versionJson } from "../../vite-plugins/build-id";

describe("build identity", () => {
  beforeEach(() => vi.stubEnv("OXYTYPE_BUILD_ID", undefined));
  afterEach(() => vi.unstubAllEnvs());
  it("uses the release-supplied build ID unchanged", () => {
    expect(resolveBuildId(false, " 26.10.16_0817_abc1234 ")).toBe(
      "26.10.16_0817_abc1234",
    );
  });

  it("falls back to the existing development stamp", () => {
    expect(resolveBuildId(true, undefined)).toBe("DEVELOPMENT_CLIENT");
    expect(resolveBuildId(true, "")).toBe("DEVELOPMENT_CLIENT");
  });

  it("stamps production builds with a timestamp and commit", () => {
    expect(resolveBuildId(false, undefined)).toMatch(
      /^\d{4}\.\d{2}\.\d{2}_\d{2}\.\d{2}_[\w-]+$/,
    );
  });

  it.each(["has space", "../escape", "a".repeat(65), 'quote"'])(
    "rejects unsafe build ID %s",
    (value) => {
      expect(() => resolveBuildId(false, value)).toThrow(/OXYTYPE_BUILD_ID/);
    },
  );

  it("keeps the public version.json shape", () => {
    expect(JSON.parse(versionJson("build-1"))).toEqual({ version: "build-1" });
  });
});
