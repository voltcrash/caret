import type { Config } from "@oxytype/schemas/configs";
import { describe, expect, it } from "vite-plus/test";

import { getDefaultConfig } from "../src/config/default-config";
import { supportedConfigSchema } from "../src/config/migrate";
import { resolveConfigChange, resolveFullConfig } from "../src/config/setter";

function config(overrides: Partial<Config> = {}): Config {
  return { ...getDefaultConfig(), ...overrides };
}

describe("resolveConfigChange", () => {
  it("applies dependent settings before the requested one", () => {
    const result = resolveConfigChange(
      "confidenceMode",
      "max",
      config({ stopOnError: "letter", freedomMode: false }),
    );
    expect(result).toEqual({
      ok: true,
      changes: [
        { key: "stopOnError", value: "off", previousValue: "letter" },
        { key: "confidenceMode", value: "max", previousValue: "off" },
      ],
    });
  });

  it("follows overrides recursively", () => {
    const result = resolveConfigChange(
      "words",
      50,
      config({ mode: "quote", punctuation: false }),
    );
    expect(result.ok && result.changes.map((change) => change.key)).toEqual([
      "mode",
      "words",
    ]);
    const quote = resolveConfigChange(
      "mode",
      "quote",
      config({ numbers: true }),
    );
    expect(quote.ok && quote.changes).toEqual([
      { key: "numbers", value: false, previousValue: true },
      { key: "mode", value: "quote", previousValue: "time" },
    ]);
  });

  it("uses value overrides", () => {
    const result = resolveConfigChange(
      "punctuation",
      true,
      config({ mode: "quote" }),
    );
    expect(result.ok && result.changes).toEqual([
      { key: "punctuation", value: false, previousValue: false },
    ]);
  });

  it("reports shared and client block reasons", () => {
    expect(
      resolveConfigChange("showAllLines", true, config({ tapeMode: "word" })),
    ).toEqual({
      ok: false,
      reason: "blocked",
      key: "showAllLines",
      message: "Show all lines doesn't support tape mode.",
    });
    expect(
      resolveConfigChange("paceCaret", "tagPb", config(), {
        blockedReason: (key) => (key === "paceCaret" ? "no tags" : undefined),
      }),
    ).toMatchObject({ ok: false, reason: "blocked", message: "no tags" });
  });

  it("rejects invalid values with the setting label", () => {
    expect(
      resolveConfigChange("caretStyle", "banana", config(), {
        schema: supportedConfigSchema,
      }),
    ).toMatchObject({ ok: false, reason: "invalid" });
    expect(
      resolveConfigChange("minWpmCustomSpeed", -5, config()),
    ).toMatchObject({
      ok: false,
      reason: "invalid",
      message:
        "Invalid value for min speed custom (-5). Please try to change this setting again.",
    });
  });

  it("protects no quit tests and funbox constraints", () => {
    expect(
      resolveConfigChange("numbers", true, config({ funbox: ["no_quit"] }), {
        testActive: true,
      }),
    ).toMatchObject({ ok: false, reason: "noQuit" });
    expect(
      resolveConfigChange("time", 0, config({ funbox: ["plus_one"] })),
    ).toMatchObject({
      ok: false,
      reason: "funbox",
      message: "Active funboxes do not support infinite tests",
    });
  });
});

describe("resolveFullConfig", () => {
  it("applies mode-changing settings last", () => {
    const { config: result, rejected } = resolveFullConfig({
      mode: "time",
      time: 15,
      words: 50,
      quoteLength: [1],
      punctuation: true,
    });
    expect(result.mode).toBe("time");
    expect(result.time).toBe(15);
    expect(result.words).toBe(50);
    expect(result.quoteLength).toEqual([1]);
    expect(result.punctuation).toBe(true);
    expect(rejected).toEqual([]);
  });

  it("lets later rules win and keeps defaults for rejected values", () => {
    const { config: result, rejected } = resolveFullConfig(
      { tapeMode: "word", showAllLines: true, caretStyle: "banana" },
      { schema: supportedConfigSchema },
    );
    expect(result.tapeMode).toBe("word");
    expect(result.showAllLines).toBe(false);
    expect(result.caretStyle).toBe("default");
    // The config schema has no legacy mascot setting.
    expect(rejected).toEqual(["monkey"]);
  });
});
