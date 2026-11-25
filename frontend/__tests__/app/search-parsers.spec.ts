import { describe, expect, it } from "vite-plus/test";
import { parseSettingsSearch } from "../../src/features/settings/search";
import { parseLeaderboardSearch } from "../../src/features/leaderboards/search";

describe("parseSettingsSearch", () => {
  it("accepts valid tabs and highlight strings", () => {
    expect(
      parseSettingsSearch({ tab: "theme", highlight: "fontSize" }),
    ).toEqual({ tab: "theme", highlight: "fontSize" });
    expect(parseSettingsSearch({})).toEqual({
      tab: undefined,
      highlight: undefined,
    });
  });

  it("clears all params when tab is invalid", () => {
    expect(
      parseSettingsSearch({ tab: "bogus", highlight: "fontSize" }),
    ).toEqual({ tab: undefined, highlight: undefined });
  });
});

describe("parseLeaderboardSearch", () => {
  it("parses valid speed and weekly leaderboard query params", () => {
    expect(
      parseLeaderboardSearch({
        client: "web",
        type: "daily",
        mode: "time",
        mode2: "60",
        language: "english_1k",
        yesterday: "t",
        page: "3",
        goToUserPage: "true",
      }),
    ).toEqual({
      client: "web",
      type: "daily",
      mode: "time",
      mode2: "60",
      language: "english_1k",
      yesterday: true,
      lastWeek: undefined,
      page: 3,
      goToUserPage: true,
    });
  });

  it("clears all params on invalid client, type, language, or NaN page", () => {
    const empty = {
      client: undefined,
      type: undefined,
      mode: undefined,
      mode2: undefined,
      language: undefined,
      yesterday: undefined,
      lastWeek: undefined,
      page: undefined,
      goToUserPage: undefined,
    };
    expect(parseLeaderboardSearch({ client: "cli", type: "daily" })).toEqual(
      empty,
    );
    expect(parseLeaderboardSearch({ type: "monthly" })).toEqual(empty);
    expect(parseLeaderboardSearch({ language: "../bad" })).toEqual(empty);
    expect(parseLeaderboardSearch({ page: "abc" })).toEqual(empty);
  });
});
