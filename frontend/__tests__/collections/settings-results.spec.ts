import { expect, it, vi } from "vite-plus/test";
import type { FunboxName } from "@oxytype/schemas/configs";
import type { ResultMinified } from "@oxytype/schemas/results";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../src/ts/states/core", () => ({
  isAuthenticated: () => true,
  getUserId: () => "settings-user",
}));
vi.mock("../../src/ts/ape", () => ({ default: { results: { get } } }));
vi.mock("../../src/ts/collections/tags", () => ({
  getTagsOnce: async () => [],
  getActiveTagsOnce: async () => [],
  useActiveTagsLiveQuery: () => [],
  reconcileLocalTagPB: vi.fn(),
  saveLocalTagPB: vi.fn(),
}));
vi.mock("../../src/ts/config/store", () => ({ getConfig: {} }));
vi.mock("../../src/ts/states/test", () => ({
  getCurrentQuote: () => undefined,
}));
vi.mock("../../src/ts/utils/misc", () => ({ getMode2: () => "15" }));

import {
  getUserAverage10Once,
  getUserDailyBestOnce,
  type CurrentSettingsFilter,
} from "../../src/ts/collections/results";

function result(
  _id: string,
  wpm: number,
  funbox?: FunboxName[],
): ResultMinified {
  return {
    _id,
    uid: "settings-user",
    wpm,
    rawWpm: wpm,
    acc: 100,
    consistency: 100,
    charStats: [75, 0, 0, 0],
    mode: "time",
    mode2: "15",
    testDuration: 15,
    timestamp: Date.now(),
    keyConsistency: 100,
    funbox,
  };
}
get.mockResolvedValue({
  status: 200,
  body: {
    data: [
      result("legacy-plain", 80),
      result("plain", 100, []),
      result("read-ahead", 200, ["read_ahead"]),
      result("tts", 130, ["tts"]),
      result("combined", 150, ["read_ahead", "tts"]),
      result("reversed", 170, ["tts", "read_ahead"]),
    ],
  },
});

function settings(
  funbox: FunboxName[],
): CurrentSettingsFilter & { funbox: FunboxName[] } {
  return {
    mode: "time",
    mode2: "15",
    punctuation: false,
    numbers: false,
    language: "english",
    difficulty: "normal",
    lazyMode: false,
    funbox,
  };
}

it("averages only plain tests when no funboxes are active", async () => {
  expect((await getUserAverage10Once(settings([]))).wpm).toBe(90);
});
it("uses only the exact funbox combination for average and daily pace", async () => {
  const filter = settings(["read_ahead"]);
  expect((await getUserAverage10Once(filter)).wpm).toBe(200);
  expect((await getUserDailyBestOnce(filter)).wpm).toBe(200);
});
it("matches equivalent funbox orders without changing the caller's config", async () => {
  const filter = settings(["tts", "read_ahead"]);
  expect((await getUserAverage10Once(filter)).wpm).toBe(160);
  expect((await getUserDailyBestOnce(filter)).wpm).toBe(170);
  expect(filter.funbox).toEqual(["tts", "read_ahead"]);
});
it("keeps plain daily pace separate from modified results", async () => {
  expect((await getUserDailyBestOnce(settings([]))).wpm).toBe(100);
});
