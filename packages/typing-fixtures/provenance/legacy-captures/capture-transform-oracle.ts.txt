import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { mulberry32 } from "./lib/keystroke-plan";
import { units } from "./rust-oracle";

// Capture new Unicode/control-character references once; no overwrite option.
let random = mulberry32(42);
const originalRandom = Math.random;
Math.random = () => random();
try {
  const { createFunboxWordFunctions } =
    await import("../src/funbox-word-functions");
  const functions = createFunboxWordFunctions({
    getConfig: () => ({ language: "english", customPolyglot: [] }),
    getLanguage: async () => {
      throw new Error("Unexpected language request");
    },
    getPoem: async () => false,
    getSection: async () => false,
    disableFunbox: () => undefined,
    setLanguage: () => undefined,
  });
  const output = [];
  for (const name of [
    "backwards",
    "ALL_CAPS",
    "capitals",
    "sPoNgEcAsE",
    "rAnDoMcAsE",
    "rot13",
    "ddoouubblleedd",
    "instant_messaging",
    "underscore_spaces",
  ] as const) {
    for (const word of [
      "hello",
      "a😀b",
      "ßéΣa",
      "ab!\n",
      "ab?\r",
      "ab.\r\n",
      "a\ud83d",
      "\tHi\n",
      "one  two",
      "Kİſ",
      "\u2028x\u2029",
    ]) {
      const alter = functions[name]?.alterText;
      if (alter === undefined) throw new Error(`Missing ${name}`);
      random = mulberry32(42);
      output.push({
        name,
        word: units(word),
        index: 1,
        bound: 3,
        seed: 42,
        expected: units(alter(word, 1, 3)),
      });
    }
  }
  writeFileSync(
    resolve(
      import.meta.dirname,
      "../../typing-fixtures/oracle/transforms.json",
    ),
    `${JSON.stringify(output, null, 2)}\n`,
    { flag: "wx" },
  );
} finally {
  Math.random = originalRandom;
}
