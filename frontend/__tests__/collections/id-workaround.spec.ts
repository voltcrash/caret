import { expect, it } from "vite-plus/test";
import { applyIdWorkaround } from "../../src/ts/collections/utils/misc";

it("updates the id alias on the original collection item", () => {
  const item = { _id: "server-id", id: "old-id", name: "preset" };
  expect(applyIdWorkaround(item)).toBe(item);
  expect(item).toEqual({ _id: "server-id", id: "server-id", name: "preset" });
  expect(applyIdWorkaround({ _id: "new" })).toEqual({ _id: "new", id: "new" });
});
