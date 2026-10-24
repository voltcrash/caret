import { expect, it } from "vite-plus/test";
import { projectEngineConfig } from "../src/config";

it("projects generated engine settings without retaining mutable web preferences", () => {
  const web = { mode: "words", words: 25, funbox: ["ALL_CAPS"], theme: "rust" };
  const projected = projectEngineConfig(web);
  expect(projected.mode).toBe("words");
  expect(projected.words).toBe(25);
  expect(projected.funbox).toEqual(["ALL_CAPS"]);
  expect(projected).not.toHaveProperty("theme");
  expect(projected).toEqual({
    ...projectEngineConfig({}),
    mode: "words",
    words: 25,
    funbox: ["ALL_CAPS"],
  });
  web.funbox.push("nospace");
  expect(projected.funbox).toEqual(["ALL_CAPS"]);
  projected.funbox.push("backwards");
  expect(projectEngineConfig({}).funbox).toEqual([]);
  // Invalid settings still reach Rust validation; the adapter does not repair rules.
  expect(projectEngineConfig({ mode: "unknown", words: -1 }).words).toBe(-1);
});
