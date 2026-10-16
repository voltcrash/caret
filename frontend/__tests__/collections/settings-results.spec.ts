import { mockHttpFixture } from "../__harness__/operations";
import { expect, it, vi } from "vite-plus/test";
import type { FunboxName } from "@oxytype/schemas/configs";
import type { ResultMinified } from "@oxytype/schemas/results";

const { get, updateTagsApi } = vi.hoisted(() => ({
  get: vi.fn(),
  updateTagsApi: vi.fn(),
}));
vi.mock("../../src/ts/states/core", () => ({
  isAuthenticated: () => true,
  getUserId: () => "settings-user",
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

import {
  getUserAverage10Once,
  getUserDailyBestOnce,
  type CurrentSettingsFilter,
  createResultsQueryState,
  getResultsQueryOnce,
  insertLocalResult,
  deleteLocalTag,
  waitForResultsReady,
  updateTags,
} from "../../src/ts/collections/results";
import defaultResultFilters from "../../src/ts/constants/default-result-filters";
import type { SnapshotResult } from "../../src/ts/constants/default-snapshot";
import type { Mode } from "@oxytype/schemas/shared";

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

it("normalizes filters and preserves sorted selections", async () => {
  const filters = structuredClone(defaultResultFilters);
  filters.funbox = { none: true };
  const queryState = createResultsQueryState(filters);
  expect(queryState.punctuation).toEqual([true, false]);
  expect(queryState.quoteLength).toEqual([0, 1, 2, 3, -1]);
  expect(queryState.timestamp).toBe(0);
  const selected = await getResultsQueryOnce({
    queryState: () => queryState,
    sorting: () => ({ field: "wpm", direction: "desc" }),
  });
  expect(selected?.map((item) => item._id)).toEqual(["plain", "legacy-plain"]);
  expect(selected?.[0]).toMatchObject({
    language: "english",
    difficulty: "normal",
    client: "web",
    timeTyping: 15,
    funbox: [],
  });
});

it("keeps disabled query states empty", async () => {
  expect(
    await getResultsQueryOnce({
      queryState: () => undefined,
      sorting: () => ({ field: "wpm", direction: "desc" }),
    }),
  ).toBeUndefined();
});

it("uses the first selected date filter and retains client selection", () => {
  vi.spyOn(Date, "now").mockReturnValue(1_000_000_000);
  try {
    const filters = structuredClone(defaultResultFilters);
    filters.date = {
      all: false,
      last_day: true,
      last_week: true,
      last_month: false,
      last_3months: false,
    };
    expect(createResultsQueryState(filters, "tui")).toMatchObject({
      client: "tui",
      timestamp: 1_000_000_000 - 86_400_000,
    });
  } finally {
    vi.restoreAllMocks();
  }
});

it("normalizes inserted results and persists optimistic tag edits", async () => {
  await waitForResultsReady();
  const local = {
    ...result("local", 110, []),
    tags: ["a", "b"],
    client: "web",
    afkDuration: 5,
    incompleteTestSeconds: 2,
  } as SnapshotResult<Mode>;
  await insertLocalResult({ result: local });
  const queryState = createResultsQueryState(defaultResultFilters);
  queryState.tags = ["none", "a", "b", "c"];
  const selected = async (): ReturnType<typeof getResultsQueryOnce> =>
    await getResultsQueryOnce({
      queryState: () => queryState,
      sorting: () => ({ field: "wpm", direction: "desc" }),
    });
  expect(
    (await selected())?.find((item) => item._id === "local"),
  ).toMatchObject({ tags: ["a", "b"], timeTyping: 12 });
  updateTagsApi.mockResolvedValue({
    status: 200,
    body: { data: { tagPbs: ["c"] } },
  });
  expect(
    await updateTags({
      resultId: "local",
      currentTagIds: ["a", "b"],
      newTagIds: ["b", "c"],
    }),
  ).toEqual({ tagPbs: ["c"] });
  expect(updateTagsApi).toHaveBeenCalledWith({
    body: { resultId: "local", tagIds: ["b", "c"] },
  });
  await deleteLocalTag({ tagId: "b" });
  expect(
    (await selected())?.find((item) => item._id === "local")?.tags,
  ).toEqual(["c"]);
});

mockHttpFixture("results.get", async (input) => await get(input));

mockHttpFixture(
  "results.updateTags",
  async (input) => await updateTagsApi(input),
);
