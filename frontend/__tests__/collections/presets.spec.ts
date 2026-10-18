import { mockHttpFixture } from "../__harness__/operations";
import { createEffect, createRoot, untrack } from "solid-js";
import { expect, it, vi } from "vite-plus/test";

const { get, remove } = vi.hoisted(() => ({ get: vi.fn(), remove: vi.fn() }));
vi.mock("../../src/ts/states/core", () => ({
  isAuthenticated: () => true,
  getUserId: () => "presets-user",
}));

import {
  deletePreset,
  getPreset,
  getPresets,
  waitForPresetsReady,
} from "../../src/ts/collections/presets";

get.mockResolvedValue({
  status: 200,
  body: {
    data: [
      { _id: "z", name: "zen_mode", config: {} },
      { _id: "f", name: "fast", config: {} },
      { _id: "s", name: "slow", config: {} },
    ],
  },
});
remove.mockResolvedValue({ status: 200, body: {} });

it("reads presets sorted by name with underscores replaced", async () => {
  await waitForPresetsReady();
  expect(getPresets().map((it) => it.name)).toEqual([
    "fast",
    "slow",
    "zen mode",
  ]);
  expect(getPreset("z")?.name).toBe("zen mode");
  expect(getPreset("missing")).toBeUndefined();
});

it("tracks deletions in reactive scopes but not untracked reads", async () => {
  await waitForPresetsReady();
  const tracked: string[][] = [];
  let untrackedRuns = 0;
  const dispose = createRoot((dispose) => {
    createEffect(() => tracked.push(getPresets().map((it) => it._id)));
    createEffect(() => {
      untrack(() => getPreset("f"));
      untrackedRuns++;
    });
    return dispose;
  });

  await deletePreset({ presetId: "f" });

  expect(tracked.at(-1)).toEqual(["s", "z"]);
  expect(untrackedRuns).toBe(1);
  dispose();
});

it("rolls back an optimistic deletion when the function rejects it", async () => {
  await waitForPresetsReady();
  let finish!: (value: unknown) => void;
  remove.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const pending = deletePreset({ presetId: "s" });
  const rejected = expect(pending).rejects.toThrow(
    "Failed to delete preset: limited",
  );
  expect(getPreset("s")).toBeUndefined();
  await vi.waitFor(() => expect(finish).toBeDefined());
  finish({ status: 429, body: { message: "limited" } });
  await rejected;
  expect(getPreset("s")?.name).toBe("slow");
});

mockHttpFixture("presets.get", async (input) => await get(input));

mockHttpFixture("presets.delete", async (input) => await remove(input));
