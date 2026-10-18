import { mockHttpFixture } from "../__harness__/operations";
import { expect, it, vi } from "vite-plus/test";
import type { ResultMinified } from "@oxytype/schemas/results";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../src/ts/states/core", () => ({
  isAuthenticated: () => true,
  getUserId: () => "typing-time",
}));

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

import defaultFilters from "../../src/ts/constants/default-result-filters";
import {
  createResultsQueryState,
  getResultsQueryOnce,
} from "../../src/ts/collections/results";

const cases = [
  { name: "subtracts AFK", fields: { afkDuration: 5 }, expected: 10 },
  {
    name: "includes incomplete attempts",
    fields: { afkDuration: 5, incompleteTestSeconds: 8, restartCount: 2 },
    expected: 18,
  },
  {
    name: "does not estimate modern restarts",
    fields: { restartCount: 2 },
    expected: 15,
  },
  {
    name: "retains legacy timed restart estimates",
    fields: { testDuration: undefined, mode2: "30", restartCount: 2 },
    expected: 45,
  },
  {
    name: "retains legacy word estimates",
    fields: { testDuration: undefined, mode: "words", mode2: "10" },
    expected: 10,
  },
  {
    name: "retains legacy incomplete seconds",
    fields: { testDuration: undefined, mode2: "30", incompleteTestSeconds: 10 },
    expected: 40,
  },
  {
    name: "reads legacy numeric strings",
    fields: { testDuration: "15.5", afkDuration: 2 },
    expected: 13.5,
  },
  { name: "clamps negative time", fields: { afkDuration: 20 }, expected: 0 },
  {
    name: "ignores malformed legacy durations",
    fields: { testDuration: "invalid" },
    expected: 0,
  },
  {
    name: "avoids infinite legacy estimates",
    fields: { testDuration: undefined, mode: "words", mode2: "10", wpm: 0 },
    expected: 0,
  },
];
get.mockResolvedValue({
  status: 200,
  body: {
    data: cases.map(
      ({ name, fields }) =>
        ({
          _id: name,
          uid: "typing-time",
          wpm: 60,
          rawWpm: 60,
          acc: 100,
          consistency: 100,
          charStats: [75, 0, 0, 0],
          mode: "time",
          mode2: "15",
          testDuration: 15,
          timestamp: Date.now(),
          keyConsistency: 100,
          ...fields,
        }) as unknown as ResultMinified,
    ),
  },
});

it.each(cases)(
  "$name in normalized account history",
  async ({ name, expected }) => {
    const rows = await getResultsQueryOnce({
      queryState: () => createResultsQueryState(defaultFilters),
      sorting: () => ({ field: "timestamp", direction: "desc" }),
    });
    expect(rows?.find((row) => row._id === name)?.timeTyping).toBe(expected);
  },
);

mockHttpFixture("results.get", async (input) => await get(input));
