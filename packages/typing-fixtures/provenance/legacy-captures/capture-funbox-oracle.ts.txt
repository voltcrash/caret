import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getAllFunboxes,
  checkCompatibility,
  checkForcedConfig,
} from "@oxytype/funbox";
import { canSetConfigWithCurrentFunboxes } from "../src/config/funbox-validation";
import type { ConfigValue } from "@oxytype/schemas/configs";
const source = getAllFunboxes();
const metadata = source.map(
  ({
    name,
    properties = [],
    frontendFunctions = [],
    frontendForcedConfig = {},
    canGetPb,
    difficultyLevel,
    cssModifications = [],
  }) => ({
    name,
    properties,
    frontendFunctions,
    frontendForcedConfig,
    canGetPb,
    difficultyLevel,
    cssModifications,
  }),
);
const combinations = metadata.flatMap((a) =>
  metadata.map((b) => ({
    names: [a.name, b.name],
    compatible: checkCompatibility([a.name, b.name]),
  })),
);
const forced = source.flatMap((f) =>
  (
    [
      ["mode", "time"],
      ["mode", "words"],
      ["mode", "quote"],
      ["mode", "custom"],
      ["mode", "zen"],
      ["words", 0],
      ["words", 10],
      ["time", 0],
      ["time", 15],
      ["punctuation", true],
      ["punctuation", false],
      ["numbers", true],
      ["numbers", false],
      ["highlightMode", "word"],
      ["highlightMode", "letter"],
      ["highlightMode", "off"],
    ] as [string, ConfigValue][]
  ).map(([key, value]) => ({
    names: [f.name],
    key,
    value,
    forced: checkForcedConfig(key, value, [f]),
    canSet: canSetConfigWithCurrentFunboxes(key, value, [f.name]),
  })),
);
const root = resolve(import.meta.dirname, "../../..");
writeFileSync(
  resolve(root, "crates/typing-engine/data/funboxes.json"),
  `${JSON.stringify(metadata, null, 2)}\n`,
  { flag: "wx" },
);
writeFileSync(
  resolve(root, "packages/typing-fixtures/oracle/funboxes.json"),
  `${JSON.stringify({ combinations, forced }, null, 2)}\n`,
  { flag: "wx" },
);
