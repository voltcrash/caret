import { createHash } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { legacyHash } from "../src/legacy-hash";

// Frozen with the real legacy package before replacing it. Include values
// omitted by JSON as well as old-client, offline and persisted replay shapes.
function samples(): object[] {
  const result = {
    uid: "user",
    wpm: 100,
    acc: 98.5,
    chartData: { wpm: [1, 2], err: [0, 1] },
    keySpacing: [10.1, 20.2, 30.3],
    tags: [],
    language: "korean",
    funbox: [],
    timestamp: 1700000000000,
  };
  const shared = { value: 1 };
  const cycle: { self?: object } = {};
  cycle.self = cycle;
  return [
    {},
    [],
    result,
    { ...result, client: "web" },
    { ...result, offline: true },
    { ...result, offline: false },
    [
      [10, 20, 30],
      [40, 50, 60],
    ],
    { missing: undefined, nil: null, yes: true, no: false },
    { unicode: "한글😀\ud800\udfff", text: "\0" },
    { values: [NaN, Infinity, -Infinity, -0, 1e-7, 1e21] },
    { first: shared, second: shared },
    cycle,
    Object.assign(Object.create(null) as object, { value: 1 }),
    { constructor: "stored", prototype: null, __proto__: null },
    ...Array.from({ length: 257 }, (_, length) => ({
      text: "a".repeat(length),
      numbers: Array.from({ length }, (_, i) => i / 3),
    })),
  ];
}

describe("legacy result hash", () => {
  it("retains old-client, offline, duplicate and replay digests", () => {
    const digest = createHash("sha256");
    for (const value of samples()) {
      digest.update(legacyHash(value));
    }
    expect(digest.digest("hex")).toBe(
      "df6399977287ed591eb04461031b7941d4fee0148cd1f2b62cfd60912cb82061",
    );
  });
  it("keeps object keys unordered and array elements ordered", () => {
    expect(legacyHash({ a: 1, b: 2 })).toBe(legacyHash({ b: 2, a: 1 }));
    expect(legacyHash([1, 2])).not.toBe(legacyHash([2, 1]));
  });
});
