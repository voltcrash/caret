import { afterEach, describe, expect, it } from "vite-plus/test";
// Browser entry shares the schema's ESM Zod constructors.
import { safeParse, serialize } from "zod-urlsearchparams/dist/index.mjs";

import { sectionForTab } from "../../src/features/settings/tabs";
import { setUserId } from "../../src/ts/states/core";
import {
  getAvailableSettingsSections,
  SettingsUrlParamsSchema,
} from "../../src/ts/states/settings-sections";

afterEach(() => {
  setUserId(null);
});

describe("settings sections", () => {
  const accountSections = ["account"] as const;

  it.each(["blockedUsers"] as const)(
    "omits %s and returns stale links to general settings",
    (tab) => {
      const params = safeParse({
        schema: SettingsUrlParamsSchema,
        input: new URLSearchParams({ tab }),
      });
      if (!params.success) throw params.error;
      for (const userId of [null, "settings-user"]) {
        setUserId(userId);
        expect(getAvailableSettingsSections()).not.toHaveProperty(tab);
        expect(sectionForTab(params.data.tab, userId !== null)).toBe(
          "behavior",
        );
      }
    },
  );

  it("reads legacy authentication query strings and writes canonical account links", () => {
    expect(
      safeParse({
        schema: SettingsUrlParamsSchema,
        input: new URLSearchParams("tab=authentication"),
      }),
    ).toMatchObject({ success: true, data: { tab: "authentication" } });
    expect(
      serialize({
        schema: SettingsUrlParamsSchema,
        data: { tab: "account" },
      }).toString(),
    ).toBe("tab=account");
  });

  it("opens account for legacy authentication links without a separate sidebar item", () => {
    setUserId("settings-user");
    const params = SettingsUrlParamsSchema.parse({ tab: "authentication" });
    expect(params).toEqual({ tab: "authentication" });
    expect(sectionForTab(params.tab, true)).toBe("account");
    expect(getAvailableSettingsSections()).not.toHaveProperty("authentication");
  });

  it("keeps legacy authentication links gated while signed out", () => {
    expect(sectionForTab("authentication", false)).toBe("behavior");
  });

  it.each(accountSections)("accepts signed-in %s section links", (tab) => {
    setUserId("settings-user");
    expect(SettingsUrlParamsSchema.parse({ tab })).toEqual({ tab });
    expect(sectionForTab(tab, true)).toBe(tab);
    expect(getAvailableSettingsSections()).toHaveProperty(tab);
  });

  it.each(accountSections)(
    "hides signed-out %s sections and falls back for links",
    (tab) => {
      setUserId(null);
      expect(getAvailableSettingsSections()).not.toHaveProperty(tab);
      expect(sectionForTab(tab, false)).toBe("behavior");
    },
  );

  it("keeps the shared danger zone available without an account", () => {
    setUserId(null);
    expect(sectionForTab("dangerZone", false)).toBe("dangerZone");
    expect(getAvailableSettingsSections()).toHaveProperty("dangerZone");
  });

  it("selects the section from the url params and leaves it unset without one", () => {
    expect(sectionForTab("theme", false)).toBe("theme");
    expect(sectionForTab(undefined, true)).toBeUndefined();
  });

  it("accepts known sections plus the highlight deep link, ignoring others", () => {
    expect(
      SettingsUrlParamsSchema.parse({ tab: "sound", highlight: "x", y: 1 }),
    ).toEqual({ tab: "sound", highlight: "x" });
    expect(SettingsUrlParamsSchema.safeParse({ tab: "nope" }).success).toBe(
      false,
    );
  });
});
