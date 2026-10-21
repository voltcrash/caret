import { describe, expect, it } from "vite-plus/test";

import { accountSettingsHref, canonicalHref } from "../../src/app/aliases";

describe("legacy URL aliases", () => {
  it("maps former entries to canonical routes with query and hash", () => {
    expect(
      canonicalHref({ pathname: "/index.html", searchStr: "?a=1", hash: "h" }),
    ).toBe("/?a=1#h");
    expect(
      canonicalHref({ pathname: "/oauth-callback/", searchStr: "", hash: "" }),
    ).toBe("/oauth-callback.html");
    expect(
      canonicalHref({ pathname: "/leaderboards", searchStr: "", hash: "" }),
    ).toBeUndefined();
  });

  it("keeps the old account-settings merge order: original keys override", () => {
    expect(accountSettingsHref("", "")).toBe("/settings?tab=account");
    expect(accountSettingsHref("?highlight=x&tab=theme", "top")).toBe(
      "/settings?tab=theme&highlight=x#top",
    );
  });
});
