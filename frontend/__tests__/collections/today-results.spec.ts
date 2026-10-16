import { expect, it, vi } from "vite-plus/test";
import type { ResultMinified } from "@oxytype/schemas/results";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../src/ts/states/core", () => ({
  isAuthenticated: () => true,
  getUserId: () => "today-user",
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
  getResultsSinceDayOnce,
  waitForResultsReady,
} from "../../src/ts/collections/results";
import * as TodayTracker from "../../src/features/typing/runtime/today-tracker";

const midnight = new Date();
midnight.setHours(0, 0, 0, 0);
const hour = 60 * 60 * 1000;

function result(
  _id: string,
  timestamp: number,
  fields: Partial<ResultMinified> = {},
): ResultMinified {
  return {
    _id,
    uid: "today-user",
    wpm: 100,
    rawWpm: 100,
    acc: 100,
    consistency: 100,
    charStats: [75, 0, 0, 0],
    mode: "time",
    mode2: "15",
    testDuration: 15,
    timestamp,
    keyConsistency: 100,
    ...fields,
  };
}

get.mockResolvedValue({
  status: 200,
  body: {
    data: [
      result("yesterday", midnight.getTime() - hour),
      result("midnight", midnight.getTime()),
      result("today", midnight.getTime() + hour, {
        afkDuration: 5,
        incompleteTestSeconds: 8,
      }),
    ],
  },
});

it("returns only results from the given day onwards", async () => {
  await waitForResultsReady();
  const results = await getResultsSinceDayOnce(midnight.getTime());
  expect(results.map((it) => it._id).sort()).toEqual(["midnight", "today"]);
});

it("sums today's typing time from collection results", async () => {
  await waitForResultsReady();
  await TodayTracker.addAllFromToday();
  // midnight: 15, today: 15 + 8 - 5
  expect(TodayTracker.getString()).toBe("00:00:33 today");
});
