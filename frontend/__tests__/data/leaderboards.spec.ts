import { describe, expect, it } from "vite-plus/test";

import { boardKey, leaderboardOptions } from "../../src/data/leaderboards";
import type { Selection } from "../../src/features/leaderboards/selection";

describe("leaderboard query keys", () => {
  it.each(["allTime", "daily", "weekly"] as const)(
    "partitions %s boards by client, period and page",
    (type) => {
      for (const previous of [false, true]) {
        const selection: Selection =
          type === "weekly"
            ? { type, previous }
            : {
                type,
                previous,
                mode: "time",
                mode2: "15",
                language: "english",
              };
        const key = (overrides: Partial<Selection>, page = 0): unknown =>
          leaderboardOptions({ ...selection, ...overrides } as Selection, page)
            .queryKey;
        expect(key({ client: "web" })).not.toEqual(key({ client: "tui" }));
        expect(key({ client: "web" })).toEqual(key({}));
        expect(key({ previous: !previous })).not.toEqual(key({}));
        expect(key({}, 1)).not.toEqual(key({}));
        expect(boardKey({ ...selection, client: "tui" })).toMatchObject({
          client: "tui",
          previous,
        });
      }
    },
  );
});
