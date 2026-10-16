import { createEffect, createRoot, untrack } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("../../src/ts/states/core", () => ({
  isAuthenticated: () => true,
  getUserId: () => "tags-user",
}));
vi.mock("../../src/ts/queries/account", () => ({
  loadAccountData: async () => ({
    tags: [
      { _id: "b", name: "beta_tag", personalBests: {} },
      { _id: "a", name: "alpha", personalBests: {} },
    ],
  }),
}));
vi.mock("../../src/ts/states/result-filters", () => ({
  updateTagsInFilterStorage: vi.fn(),
}));

import {
  getActiveTags,
  getActiveTagsPB,
  getTag,
  getTags,
  saveLocalTagPB,
  toggleTagActive,
  waitForTagsReady,
} from "../../src/ts/collections/tags";

function collect<T>(read: () => T): { values: T[]; dispose: () => void } {
  const values: T[] = [];
  const dispose = createRoot((dispose) => {
    createEffect(() => values.push(read()));
    return dispose;
  });
  return { values, dispose };
}

describe("tags getters", () => {
  it("reads loaded tags sorted by name", async () => {
    await waitForTagsReady();
    expect(getTags().map((it) => it.name)).toEqual(["alpha", "beta tag"]);
    expect(getTag("b")?.name).toBe("beta tag");
    expect(getActiveTags()).toEqual([]);
  });

  it("tracks active state inside reactive scopes", async () => {
    await waitForTagsReady();
    const active = collect(() => getActiveTags().map((it) => it._id));
    const tag = collect(() => getTag("a")?.active);

    await toggleTagActive({ tagId: "a", noSave: true });
    expect(active.values.at(-1)).toEqual(["a"]);
    expect(tag.values.at(-1)).toBe(true);

    await toggleTagActive({ tagId: "a", noSave: true });
    expect(active.values.at(-1)).toEqual([]);
    active.dispose();
    tag.dispose();
  });

  it("does not track untracked reads or internal PB lookups", async () => {
    await waitForTagsReady();
    let runs = 0;
    const dispose = createRoot((dispose) => {
      createEffect(() => {
        untrack(getTags);
        getActiveTagsPB("time", "15", false, false, "english", "normal", false);
        runs++;
      });
      return dispose;
    });

    await toggleTagActive({ tagId: "b", noSave: true });
    await toggleTagActive({ tagId: "b", noSave: true });
    expect(runs).toBe(1);
    dispose();
  });
});

describe("saveLocalTagPB", () => {
  const save = (wpm: number, punctuation = false): void =>
    saveLocalTagPB(
      "a",
      "time",
      "15",
      punctuation,
      false,
      "english",
      "normal",
      false,
      wpm,
      95,
      wpm + 5,
      80,
    );

  it("creates the mode, updates matching bests and adds new settings", async () => {
    await waitForTagsReady();
    save(70);
    expect(getTag("a")?.personalBests?.time["15"]).toEqual([
      expect.objectContaining({ wpm: 70, raw: 75, punctuation: false }),
    ]);
    save(90);
    save(60, true);
    expect(getTag("a")?.personalBests?.time["15"]).toEqual([
      expect.objectContaining({ wpm: 90, raw: 95, punctuation: false }),
      expect.objectContaining({ wpm: 60, punctuation: true }),
    ]);
    expect(getTag("a")?.personalBests?.words).toBeUndefined();
  });

  it("ignores quote mode and unknown tags", async () => {
    await waitForTagsReady();
    const before = structuredClone(getTag("a")?.personalBests);
    saveLocalTagPB(
      "a",
      "quote",
      "1",
      false,
      false,
      "english",
      "normal",
      false,
      1,
      1,
      1,
      1,
    );
    saveLocalTagPB(
      "missing",
      "time",
      "15",
      false,
      false,
      "english",
      "normal",
      false,
      1,
      1,
      1,
      1,
    );
    expect(getTag("a")?.personalBests).toEqual(before);
  });
});
