import { expect, expectTypeOf, it } from "vite-plus/test";
import { typedEntries, typedKeys, typedValues } from "../src/objects";

it("preserves key/value types and runtime property order", () => {
  const object = { label: "first", count: 2 };
  expect(typedKeys(object)).toEqual(["label", "count"]);
  expect(typedEntries(object)).toEqual([
    ["label", "first"],
    ["count", 2],
  ]);
  expect(typedValues(object)).toEqual(["first", 2]);
  expectTypeOf(typedEntries(object)).toEqualTypeOf<
    (["label", string] | ["count", number])[]
  >();
});
