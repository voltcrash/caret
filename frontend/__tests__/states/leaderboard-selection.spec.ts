import { safeParse, serialize } from "zod-urlsearchparams";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { mountApplication } from "../../src/app/application";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/test-application";

import {
  applyUrlParams,
  defaultSelection,
  urlParams,
} from "../../src/features/leaderboards/selection";

releaseTestApplication();
let dispose: () => void;
beforeEach(() => {
  const root = createTestApplication();
  const release = mountApplication(root.application);
  dispose = () => {
    release();
    root.dispose();
  };
});
afterEach(() => {
  dispose();
  localStorage.removeItem("leaderboardSelector");
});

describe("leaderboard selection", () => {
  it("round-trips client links for all-time, daily and weekly leaderboards", async () => {
    const state = await import("../../src/ts/states/leaderboard-selection");
    for (const type of ["allTime", "daily", "weekly"] as const) {
      for (const client of ["web"] as const) {
        const view = applyUrlParams(defaultSelection, {
          type,
          client,
          yesterday: true,
          lastWeek: true,
          page: 2,
        });
        expect(view.selection.client).toBe(client);
        expect(view.page).toBe(1);
        const search = serialize({
          schema: state.LeaderboardUrlParamsSchema,
          data: urlParams(view.selection, view.page),
        });
        expect(
          safeParse({
            schema: state.LeaderboardUrlParamsSchema,
            input: search,
          }),
        ).toMatchObject({ success: true, data: { client, type, page: 2 } });
      }
    }
  });

  it("applies a client-only link and resets pagination", () => {
    const view = applyUrlParams(defaultSelection, { client: "web" }, 3);
    expect(view.selection.client).toBe("web");
    expect(view.page).toBe(0);
  });

  it("rejects unknown clients in stored selections and links", async () => {
    localStorage.setItem(
      "leaderboardSelector",
      JSON.stringify({ type: "weekly", previous: false, client: "mobile" }),
    );
    const state = await import("../../src/ts/states/leaderboard-selection");
    expect(state.getSelection().client ?? "web").toBe("web");
    expect(
      state.LeaderboardUrlParamsSchema.safeParse({ client: "mobile" }).success,
    ).toBe(false);
  });

  it.each([
    {
      type: "allTime",
      mode: "time",
      mode2: "60",
      language: "english",
      previous: false,
    },
    {
      type: "daily",
      mode: "time",
      mode2: "15",
      language: "english",
      previous: true,
    },
    { type: "weekly", previous: true },
  ])(
    "drops a persisted friend filter for $type and preserves the selection",
    async (selection) => {
      localStorage.setItem(
        "leaderboardSelector",
        JSON.stringify({ ...selection, friendsOnly: true }),
      );
      const state = await import("../../src/ts/states/leaderboard-selection");
      expect(state.getSelection()).toEqual(selection);
      expect(urlParams(state.getSelection(), 1)).not.toHaveProperty(
        "friendsOnly",
      );
    },
  );

  it("ignores a legacy friend filter in a leaderboard link", async () => {
    const state = await import("../../src/ts/states/leaderboard-selection");
    const params = state.LeaderboardUrlParamsSchema.parse({
      type: "allTime",
      friendsOnly: true,
      mode2: "60",
    });
    expect(applyUrlParams(defaultSelection, params).selection).toEqual({
      client: "web",
      type: "allTime",
      mode: "time",
      mode2: "60",
      language: "english",
      previous: false,
    });
  });
});
