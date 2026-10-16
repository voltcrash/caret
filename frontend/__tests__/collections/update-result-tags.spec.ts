import { mockHttpFixture } from "../__harness__/operations";
import { expect, it, vi } from "vite-plus/test";

const { get, update, saveLocalTagPB } = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  saveLocalTagPB: vi.fn(),
}));
vi.mock("../../src/ts/states/core", () => ({
  isAuthenticated: () => true,
  getUserId: () => "tags-user",
}));

vi.mock("../../src/ts/collections/tags", () => ({
  getTagsOnce: async () => [],
  getActiveTagsOnce: async () => [],
  useActiveTagsLiveQuery: () => [],
  reconcileLocalTagPB: vi.fn(),
  saveLocalTagPB,
}));
vi.mock("../../src/ts/config/store", () => ({ getConfig: {} }));
vi.mock("../../src/ts/states/test", () => ({
  getCurrentQuote: () => undefined,
}));
vi.mock("../../src/ts/utils/misc", () => ({ getMode2: () => "15" }));

import type { SnapshotResult } from "../../src/ts/constants/default-snapshot";
import type { Mode } from "@oxytype/schemas/shared";
import { isResultsReady, updateTags } from "../../src/ts/collections/results";
import { setLastResult } from "../../src/ts/states/snapshot";

update.mockResolvedValue({
  status: 200,
  body: { data: { tagPbs: ["pb-tag"] } },
});

it("returns tag PBs from the API when results are not loaded", async () => {
  expect(isResultsReady()).toBe(false);
  setLastResult({
    _id: "last",
    mode: "time",
    mode2: "15",
    punctuation: false,
    numbers: false,
    language: "english",
    difficulty: "normal",
    lazyMode: false,
    wpm: 100,
    acc: 99,
    rawWpm: 101,
    consistency: 80,
  } as SnapshotResult<Mode>);

  await expect(
    updateTags({
      resultId: "last",
      currentTagIds: [],
      newTagIds: ["pb-tag", "other"],
    }),
  ).resolves.toEqual({ tagPbs: ["pb-tag"] });

  expect(update).toHaveBeenCalledWith({
    body: { resultId: "last", tagIds: ["pb-tag", "other"] },
  });
  expect(saveLocalTagPB).toHaveBeenCalledOnce();
  expect(saveLocalTagPB.mock.calls[0]?.[0]).toBe("pb-tag");
  expect(get).not.toHaveBeenCalled();
});

it("returns tag PBs for terminal results without touching web PBs", async () => {
  saveLocalTagPB.mockClear();
  await expect(
    updateTags({
      client: "tui",
      resultId: "tui",
      currentTagIds: [],
      newTagIds: ["pb-tag"],
    }),
  ).resolves.toEqual({ tagPbs: ["pb-tag"] });
  expect(saveLocalTagPB).not.toHaveBeenCalled();
});

mockHttpFixture("results.get", async (input) => await get(input));

mockHttpFixture("results.updateTags", async (input) => await update(input));
