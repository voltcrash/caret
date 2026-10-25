import { expect, it } from "vite-plus/test";
import { engineConfigMatches, projectEngineConfig } from "../src/config";

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

it("detects engine setting changes without projecting", () => {
  // Web-only preferences such as theme are ignored.
  const web = { mode: "words", funbox: ["ALL_CAPS"], theme: "rust" };
  const projected = projectEngineConfig(web);
  expect(engineConfigMatches(projected, web)).toBe(true);
  expect(engineConfigMatches(projected, { ...web, words: 10 })).toBe(false);
  expect(
    engineConfigMatches(projected, { ...web, funbox: ["ALL_CAPS", "nospace"] }),
  ).toBe(false);
  expect(engineConfigMatches(projected, { ...web, funbox: ["nospace"] })).toBe(
    false,
  );
  // Missing settings compare against the engine defaults.
  expect(engineConfigMatches(projectEngineConfig({}), {})).toBe(true);
  expect(
    engineConfigMatches(projectEngineConfig({ time: NaN }), { time: NaN }),
  ).toBe(true);
});
