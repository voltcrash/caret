import { Client } from "@oxytype/schemas/shared";
import { QueryClient } from "@tanstack/solid-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const { calls, state } = vi.hoisted(() => ({
  calls: vi.fn(),
  state: { uid: "one" },
}));
vi.mock("../../src/ts/states/core", () => ({
  getUserId: () => state.uid,
  isAuthenticated: () => false,
}));
vi.mock("../../src/ts/states/snapshot", () => ({
  getSnapshot: () => undefined,
}));
vi.mock("../../src/ts/ape", () => ({
  default: {
    users: {
      get: (args: unknown) => {
        calls("account", args);
        return {
          status: 200,
          body: {
            data: {
              uid: state.uid,
              startedTests: 8,
              completedTests: 6,
              timeTyping: 180,
              xp: 400,
              streak: { length: 2, maxLength: 9 },
              personalBests: { time: {}, words: {} },
            },
          },
        };
      },
      getProfile: (args: unknown) => {
        calls("profile", args);
        return { status: 200, body: { data: { name: "Tester" } } };
      },
      getTestActivity: (args: unknown) => {
        calls("activity", args);
        return { status: 200, body: { data: { "2026": [1] } } };
      },
      updateLeaderboardMemory: (args: unknown) => {
        calls("memory", args);
        return { status: 200, body: {} };
      },
    },
    leaderboards: Object.fromEntries(
      [
        "get",
        "getDaily",
        "getWeeklyXp",
        "getRank",
        "getDailyRank",
        "getWeeklyXpRank",
      ].map((method) => [
        method,
        (args: unknown) => {
          calls(method, args);
          return {
            status: 200,
            body: { data: { entries: [{ uid: "one" }], count: 1, rank: 1 } },
          };
        },
      ]),
    ),
  },
}));

import {
  getAccountActivityQueryOptions,
  getAccountQueryOptions,
  updateTerminalLeaderboardMemory,
} from "../../src/ts/queries/account";
import {
  getLeaderboardQueryOptions,
  getRankQueryOptions,
} from "../../src/ts/queries/leaderboards";
import { getUserProfile } from "../../src/ts/queries/profile";
import { getQueryClient } from "../../src/ts/queries";

const client = new QueryClient();
afterEach(() => {
  client.clear();
  getQueryClient().clear();
  calls.mockClear();
  state.uid = "one";
});

describe("client query partitions", () => {
  it("partitions public profiles and defaults existing callers to web", async () => {
    const web = getUserProfile("Tester");
    const tui = getUserProfile("Tester", "tui");
    expect(web.queryKey).not.toEqual(tui.queryKey);
    await client.query(web);
    await client.query(tui);
    expect(calls).toHaveBeenCalledWith("profile", {
      params: { uidOrName: "Tester" },
      query: { client: "web", isUid: false },
    });
    expect(calls).toHaveBeenCalledWith("profile", {
      params: { uidOrName: "Tester" },
      query: { client: "tui", isUid: false },
    });
  });
  it("keeps account caches separate by user and client and projects selected totals", async () => {
    const web = getAccountQueryOptions("web");
    const tui = getAccountQueryOptions("tui");
    expect(web.queryKey).not.toEqual(tui.queryKey);
    const account = await client.query(tui);
    expect(account).toMatchObject({
      xp: 400,
      streak: 2,
      maxStreak: 9,
      typingStats: { startedTests: 8, completedTests: 6, timeTyping: 180 },
    });
    expect(calls).toHaveBeenCalledWith("account", { query: { client: "tui" } });
    state.uid = "two";
    expect(getAccountQueryOptions("tui").queryKey).not.toEqual(tui.queryKey);
  });
  it("partitions year archives by client", async () => {
    for (const selected of ["web", "tui"] as const) {
      await client.query(getAccountActivityQueryOptions(selected));
      expect(calls).toHaveBeenCalledWith("activity", {
        query: { client: selected },
      });
    }
  });
  it.each([
    ["allTime", "get", "getRank"],
    ["daily", "getDaily", "getDailyRank"],
    ["weekly", "getWeeklyXp", "getWeeklyXpRank"],
  ] as const)(
    "partitions %s entries and ranks for current and previous periods",
    async (type, entries, rank) => {
      for (const previous of [false, true]) {
        const selection =
          type === "weekly"
            ? { type, previous }
            : {
                type,
                previous,
                mode: "time" as const,
                mode2: "15",
                language: "english" as const,
              };
        const web = getLeaderboardQueryOptions({
          ...selection,
          client: "web",
          page: 0,
        });
        const tui = getLeaderboardQueryOptions({
          ...selection,
          client: "tui",
          page: 0,
        });
        expect(web.queryKey).not.toEqual(tui.queryKey);
        expect(
          getRankQueryOptions({ ...selection, client: "web" }).queryKey,
        ).not.toEqual(
          getRankQueryOptions({ ...selection, client: "tui" }).queryKey,
        );
        for (const selected of ["web", "tui"] as Client[]) {
          await client.query(
            getLeaderboardQueryOptions({
              ...selection,
              client: selected,
              page: 0,
            }),
          );
          await client.query(
            getRankQueryOptions({ ...selection, client: selected }),
          );
          expect(calls).toHaveBeenCalledWith(entries, {
            query: expect.objectContaining({ client: selected, page: 0 }),
          });
          expect(calls).toHaveBeenCalledWith(rank, {
            query: expect.objectContaining({ client: selected }),
          });
        }
      }
    },
  );
  it("updates terminal rank memory without writing the web cache", async () => {
    await getQueryClient().query(getAccountQueryOptions("web"));
    await getQueryClient().query(getAccountQueryOptions("tui"));
    const web = getQueryClient().getQueryData(
      getAccountQueryOptions("web").queryKey,
    );
    await updateTerminalLeaderboardMemory("15", 7);
    expect(calls).toHaveBeenCalledWith("memory", {
      query: { client: "tui" },
      body: { mode: "time", mode2: "15", language: "english", rank: 7 },
    });
    expect(
      getQueryClient().getQueryData(getAccountQueryOptions("tui").queryKey)
        ?.lbMemory,
    ).toEqual({ time: { "15": { english: 7 } } });
    expect(
      getQueryClient().getQueryData(getAccountQueryOptions("web").queryKey),
    ).toBe(web);
  });
});
