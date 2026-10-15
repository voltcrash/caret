import { createRoot } from "solid-js";
import { afterEach, describe, expect, it } from "vite-plus/test";
// Browser entry shares the schema's ESM Zod constructors.
import { safeParse, serialize } from "zod-urlsearchparams/dist/index.mjs";

import { setUserId } from "../../src/ts/states/core";
import {
  getAvailableSettingsSections,
  getCurrentSettingsSection,
  readSettingsGetParameters,
  setCurrentSettingsSection,
  SettingsUrlParamsSchema,
  useSettingsSectionEffects,
} from "../../src/ts/states/settings-sections";

afterEach(() => {
  setUserId(null);
  setCurrentSettingsSection("behavior");
});

describe("settings sections", () => {
  const accountSections = ["account"] as const;

  it.each(["blockedUsers", "apeKeys"] as const)(
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
        setCurrentSettingsSection("account");
        readSettingsGetParameters(params.data);
        expect(getCurrentSettingsSection()).toBe("behavior");
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
    readSettingsGetParameters(params);
    expect(getCurrentSettingsSection()).toBe("account");
    expect(getAvailableSettingsSections()).not.toHaveProperty("authentication");
  });

  it("keeps legacy authentication links gated while signed out", () => {
    setUserId(null);
    readSettingsGetParameters(
      SettingsUrlParamsSchema.parse({ tab: "authentication" }),
    );
    expect(getCurrentSettingsSection()).toBe("behavior");
  });

  it.each(accountSections)("accepts signed-in %s section links", (tab) => {
    setUserId("settings-user");
    expect(SettingsUrlParamsSchema.parse({ tab })).toEqual({ tab });
    readSettingsGetParameters({ tab });
    expect(getCurrentSettingsSection()).toBe(tab);
    expect(getAvailableSettingsSections()).toHaveProperty(tab);
  });

  it.each(accountSections)(
    "hides signed-out %s sections and falls back for links",
    (tab) => {
      setUserId(null);
      expect(getAvailableSettingsSections()).not.toHaveProperty(tab);
      readSettingsGetParameters({ tab });
      expect(getCurrentSettingsSection()).toBe("behavior");
    },
  );

  it.each(accountSections)(
    "returns to general settings after signing out of %s",
    async (tab) => {
      const dispose = createRoot((dispose) => {
        useSettingsSectionEffects();
        return dispose;
      });
      setUserId("settings-user");
      readSettingsGetParameters({ tab });
      setUserId(null);
      await Promise.resolve();
      expect(getCurrentSettingsSection()).toBe("behavior");
      dispose();
    },
  );

  it("keeps the shared danger zone available without an account", () => {
    setUserId(null);
    readSettingsGetParameters({ tab: "dangerZone" });
    expect(getCurrentSettingsSection()).toBe("dangerZone");
    expect(getAvailableSettingsSections()).toHaveProperty("dangerZone");
  });

  it("selects the section from the url params", () => {
    readSettingsGetParameters({ tab: "theme" });
    expect(getCurrentSettingsSection()).toBe("theme");
  });

  it("keeps the current section without a tab param", () => {
    setCurrentSettingsSection("caret");
    readSettingsGetParameters(undefined);
    readSettingsGetParameters({});
    expect(getCurrentSettingsSection()).toBe("caret");
  });

  it("accepts known sections and ignores other params", () => {
    expect(
      SettingsUrlParamsSchema.parse({ tab: "sound", highlight: "x" }),
    ).toEqual({ tab: "sound" });
    expect(SettingsUrlParamsSchema.safeParse({ tab: "nope" }).success).toBe(
      false,
    );
  });
});
