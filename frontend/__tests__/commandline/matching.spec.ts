import { describe, expect, it } from "vite-plus/test";
import { matchCommands } from "../../src/ts/commandline/matching";
import type { Command } from "../../src/ts/commandline/types";

const commands: Command[] = [
  { id: "theme", display: "Change theme", alias: "colors" },
  { id: "font", display: "Change font", alias: "typeface" },
  {
    id: "dark",
    display: "Dark",
    singleListDisplayNoIcon: "Change theme dark",
  },
];

describe("commandline matching", () => {
  it.each(["change\ttheme", "change\ntheme", "change\u00a0theme"])(
    "treats pasted whitespace as word separators in %j",
    (query) => {
      expect(matchCommands(commands, [true, true, true], query, false)).toEqual(
        [true, false, false],
      );
    },
  );

  it("matches display words and aliases case insensitively", () => {
    expect(matchCommands(commands, [true, true, true], "THE", false)).toEqual([
      true,
      false,
      false,
    ]);
    expect(matchCommands(commands, [true, true, true], "colo", false)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it("uses the single list display and strips the quick search prefix", () => {
    expect(
      matchCommands(commands, [true, true, true], ">theme dark", true),
    ).toEqual([false, false, true]);
  });

  it("excludes unavailable commands", () => {
    expect(
      matchCommands(commands, [false, true, true], "change", false),
    ).toEqual([false, true, false]);
  });

  it("falls back to partial word coverage", () => {
    expect(
      matchCommands(commands, [true, true, true], "change unknown", false),
    ).toEqual([true, true, false]);
  });
});
