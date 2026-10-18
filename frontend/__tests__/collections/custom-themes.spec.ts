import { mockHttpFixture } from "../__harness__/operations";
import { createEffect, createRoot } from "solid-js";
import { expect, it, vi } from "vite-plus/test";

// custom themes sync on import, so responses must exist before it
const { fetchThemes, remove } = vi.hoisted(() => {
  const colors = Array<string>(10).fill("#000000");
  return {
    fetchThemes: vi.fn().mockResolvedValue({
      status: 200,
      body: {
        data: [
          { _id: "2", name: "night", colors },
          { _id: "1", name: "dawn", colors },
        ],
      },
    }),
    remove: vi.fn().mockResolvedValue({ status: 200, body: {} }),
  };
});
vi.mock("../../src/ts/states/core", () => ({
  isAuthenticated: () => true,
  getUserId: () => "themes-user",
}));

import {
  deleteCustomTheme,
  getCustomTheme,
  getCustomThemes,
} from "../../src/ts/collections/custom-themes";

it("reads custom themes sorted by name and tracks changes", async () => {
  const names: string[][] = [];
  const dispose = createRoot((dispose) => {
    createEffect(() => names.push(getCustomThemes().map((it) => it.name)));
    return dispose;
  });

  await vi.waitFor(() => expect(names.at(-1)).toEqual(["dawn", "night"]));
  expect(getCustomTheme("2")?.name).toBe("night");

  await deleteCustomTheme({ themeId: "1" });
  expect(names.at(-1)).toEqual(["night"]);
  expect(getCustomTheme("1")).toBeUndefined();
  dispose();
});

mockHttpFixture(
  "users.getCustomThemes",
  async (input) => await fetchThemes(input),
);

mockHttpFixture(
  "users.deleteCustomTheme",
  async (input) => await remove(input),
);
