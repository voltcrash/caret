import { safeParse } from "zod-urlsearchparams";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const { replaceUrl } = vi.hoisted(() => ({
  replaceUrl: vi.fn(async (_url: string) => undefined),
}));
vi.mock("../../src/ts/navigation/navigation", () => ({ replaceUrl }));

beforeEach(async () => {
  await import("../__harness__/mock-application");
});
afterEach(async () => {
  (await import("../__harness__/mock-application")).releaseTestApplication();
  localStorage.removeItem("leaderboardSelector");
  vi.resetModules();
  replaceUrl.mockClear();
});

describe("global leaderboard selection", () => {
  it("round-trips client links for all-time, daily and weekly leaderboards", async () => {
    const state = await import("../../src/ts/states/leaderboard-selection");
    for (const type of ["allTime", "daily", "weekly"] as const) {
      for (const client of ["web", "tui"] as const) {
        state.readLeaderboardGetParameters({
          type,
          client,
          yesterday: true,
          lastWeek: true,
          page: 2,
        });
        expect(state.getSelection().client).toBe(client);
        expect(state.getPage()).toBe(1);
        state.updateGetParameters(state.getSelection(), state.getPage());
        const url = new URL(
          replaceUrl.mock.calls.at(-1)?.[0] ?? "",
          "https://oxytype.test",
        );
        expect(
          safeParse({
            schema: state.LeaderboardUrlParamsSchema,
            input: url.searchParams,
          }),
        ).toMatchObject({ success: true, data: { client, type, page: 2 } });
      }
    }
  });
  it("defaults legacy web links to web after browsing TUI", async () => {
    const state = await import("../../src/ts/states/leaderboard-selection");
    state.readLeaderboardGetParameters({ type: "daily", client: "tui" });
    state.readLeaderboardGetParameters({ type: "daily" });
    expect(state.getSelection().client).toBe("web");
  });
  it("applies a client-only link and resets pagination", async () => {
    const state = await import("../../src/ts/states/leaderboard-selection");
    state.setPage(3);
    state.readLeaderboardGetParameters({ client: "tui" });
    expect(state.getSelection().client).toBe("tui");
    expect(state.getPage()).toBe(0);
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
      state.updateGetParameters(state.getSelection(), 1);
      const url = new URL(
        replaceUrl.mock.calls[0]?.[0] ?? "",
        "https://oxytype.test",
      );
      expect(url.searchParams.has("friendsOnly")).toBe(false);
    },
  );

  it("ignores a legacy friend filter in a leaderboard link", async () => {
    const state = await import("../../src/ts/states/leaderboard-selection");
    const params = state.LeaderboardUrlParamsSchema.parse({
      type: "allTime",
      friendsOnly: true,
      mode2: "60",
    });
    state.readLeaderboardGetParameters(params);
    expect(state.getSelection()).toEqual({
      client: "web",
      type: "allTime",
      mode: "time",
      mode2: "60",
      language: "english",
      previous: false,
    });
    state.updateGetParameters(state.getSelection(), 0);
    expect(replaceUrl).toHaveBeenCalledWith(
      expect.not.stringContaining("friendsOnly"),
    );
  });
});
