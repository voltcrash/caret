import { mockHttpFixture } from "../__harness__/operations";
import { ResultMinified } from "@oxytype/schemas/results";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const { get, update, reconcile } = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  reconcile: vi.fn(),
}));
vi.mock("../../src/ts/states/core", () => ({
  isAuthenticated: () => true,
  getUserId: () => "history-user",
}));

vi.mock("../../src/ts/collections/tags", () => ({
  getTagsOnce: async () => [{ _id: "tag" }],
  reconcileLocalTagPB: reconcile,
  saveLocalTagPB: vi.fn(),
  getActiveTagsOnce: async () => [],
  useActiveTagsLiveQuery: () => [],
}));
vi.mock("../../src/ts/config/store", () => ({ getConfig: {} }));
vi.mock("../../src/ts/states/test", () => ({
  getCurrentQuote: () => undefined,
}));
vi.mock("../../src/ts/utils/misc", () => ({ getMode2: () => "15" }));

import defaultFilters from "../../src/ts/constants/default-result-filters";
import {
  createResultsQueryState,
  deleteLocalTag,
  getResultsQueryOnce,
  updateTags,
} from "../../src/ts/collections/results";
import { getLastResult } from "../../src/ts/states/snapshot";

function result(
  _id: string,
  wpm: number,
  client?: "tui",
  offline?: true,
): ResultMinified {
  return {
    uid: "history-user",
    _id,
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
    client,
    offline,
    tags: ["tag"],
  };
}
get.mockImplementation(async ({ query }: { query: { client: string } }) => ({
  status: 200,
  body: {
    data:
      query.client === "web"
        ? [result("web-row", 91)]
        : [
            result("tui-row", 66, "tui"),
            result("offline-row", 55, "tui", true),
          ],
  },
}));
update.mockResolvedValue({ status: 200, body: { data: { tagPbs: ["tag"] } } });

async function history(client: "web" | "tui") {
  const filters = { ...defaultFilters, tags: { none: true, tag: true } };
  return await getResultsQueryOnce({
    queryState: () => createResultsQueryState(filters, client),
    sorting: () => ({
      field: "timestamp" as const,
      direction: "desc" as const,
    }),
  });
}
afterEach(() => {
  update.mockClear();
  reconcile.mockClear();
});

describe("account result partitions", () => {
  it("loads separate histories, normalizes legacy web rows and keeps offline rows", async () => {
    expect((await history("web"))?.map((row) => [row.client, row.wpm])).toEqual(
      [["web", 91]],
    );
    expect((await history("tui"))?.map((row) => row.wpm).sort()).toEqual([
      55, 66,
    ]);
    expect(get).toHaveBeenCalledWith({ query: { client: "web" } });
    expect(get).toHaveBeenCalledWith({ query: { client: "tui" } });
    expect(
      (await history("tui"))?.find((row) => row._id === "offline-row")?.offline,
    ).toBe(true);
    expect(getLastResult()?.client).toBe("web");
    expect(createResultsQueryState(defaultFilters).client).toBe("web");
  });
  it("updates terminal tags without changing web history or web tag PBs", async () => {
    await history("web");
    await history("tui");
    await expect(
      updateTags({
        client: "tui",
        resultId: "tui-row",
        currentTagIds: ["tag"],
        newTagIds: [],
      }),
    ).resolves.toEqual({ tagPbs: ["tag"] });
    expect(
      (await history("tui"))?.find((row) => row._id === "tui-row")?.tags,
    ).toEqual([]);
    expect((await history("web"))?.[0]?.tags).toEqual(["tag"]);
    expect(reconcile).not.toHaveBeenCalled();
  });
  it("preserves web tag PB updates and shared tag deletion across both histories", async () => {
    await history("web");
    await history("tui");
    await expect(
      updateTags({
        resultId: "web-row",
        currentTagIds: ["tag"],
        newTagIds: [],
      }),
    ).resolves.toEqual({ tagPbs: ["tag"] });
    expect(reconcile).toHaveBeenCalled();
    await deleteLocalTag({ tagId: "tag" });
    for (const client of ["web", "tui"] as const) {
      expect(
        (await history(client))?.every((row) => row.tags.length === 0),
      ).toBe(true);
    }
  });
});

mockHttpFixture("results.get", async (input) => await get(input));

mockHttpFixture("results.updateTags", async (input) => await update(input));
