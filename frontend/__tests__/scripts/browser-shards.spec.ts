import { expect, it } from "vite-plus/test";
import { balanceBrowserFiles } from "../../scripts/browser-shards";

it("balances whole files without dropping new specs or duplicating coverage", () => {
  const files = ["slow", "medium", "fast", "new", "slow"];
  const durations = { slow: 60, medium: 30, fast: 10 };
  const shards = balanceBrowserFiles(files, durations, 2);
  expect(shards.flatMap((shard) => shard.files).sort()).toEqual([
    "fast",
    "medium",
    "new",
    "slow",
  ]);
  expect(shards.map((shard) => Math.round(shard.seconds))).toEqual([70, 63]);
  expect(balanceBrowserFiles(files.toReversed(), durations, 2)).toEqual(shards);
  expect(
    balanceBrowserFiles(["a", "b"], {}, 2).map((shard) => shard.files),
  ).toEqual([["a"], ["b"]]);
});
