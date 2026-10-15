import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

// Snapshots of the words generator for the typing-core extraction. Every case
// (packages/typing-core/__fixtures__/words/cases.json) runs with a seeded
// Math.random, so typing-core can reproduce the exact same words.
// Regenerate with UPDATE_PARITY_SNAPSHOTS=1 - only when the output is meant
// to change.

const state = vi.hoisted(() => {
  // mulberry32
  const seeded = (seed: number): (() => number) => {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const s = {
    seeded,
    rng: seeded(0),
    repeated: false,
    currentQuote: null as unknown,
    selectedQuoteId: 1,
    customText: {
      text: [] as string[],
      mode: "repeat",
      limit: { value: 0, mode: "word" },
      pipeDelimiter: false,
    },
  };
  // modules pin Math.random when they load, so it has to be swapped first
  Math.random = () => s.rng();
  return s;
});

const STATIC_DIR = resolve(fileURLToPath(import.meta.url), "../../../static");

function readStatic(path: string): unknown {
  return JSON.parse(
    readFileSync(resolve(STATIC_DIR, path.replace(/^\//, "")), "utf-8"),
  ) as unknown;
}

vi.mock("../../src/ts/config/store", async () => {
  const { getDefaultConfig } =
    await import("../../src/ts/constants/default-config");
  return {
    getMutableConfig: (() => {
      const storedConfig = getDefaultConfig();
      return () => storedConfig;
    })(),
    getConfig: {},
  };
});
vi.mock("../../src/ts/config/setters", () => ({
  setConfig: vi.fn(),
  setQuoteLengthAll: vi.fn(),
  toggleFunbox: vi.fn(),
}));
vi.mock("../../src/ts/states/test", () => ({
  isRepeated: () => state.repeated,
  getCurrentQuote: () => state.currentQuote,
  setCurrentQuote: (quote: unknown) => {
    state.currentQuote = quote;
  },
  getSelectedQuoteId: () => state.selectedQuoteId,
  getActiveWordIndex: () => 0,
}));
vi.mock("../../src/ts/states/loader-bar", () => ({
  showLoaderBar: vi.fn(),
  hideLoaderBar: vi.fn(),
}));
vi.mock("../../src/ts/test/practise-words", () => ({
  before: { mode: null },
}));
vi.mock("../../src/ts/test/custom-text", () => ({
  getText: () => state.customText.text,
  getMode: () => state.customText.mode,
  getLimit: () => state.customText.limit,
  getLimitMode: () => state.customText.limit.mode,
  getLimitValue: () => state.customText.limit.value,
  getPipeDelimiter: () => state.customText.pipeDelimiter,
}));
vi.mock("../../src/ts/utils/json-data", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  // fresh objects every time - word order funboxes reverse the list in place
  getLanguage: async (lang: string) => readStatic(`languages/${lang}.json`),
  cachedFetchJson: async (url: string) => readStatic(url),
}));

import { getMutableConfig } from "../../src/ts/config/store";
import { getDefaultConfig } from "../../src/ts/constants/default-config";
import * as WordsGenerator from "../../src/ts/test/words-generator";
import * as TestWords from "../../src/ts/test/test-words";
import * as JSONData from "../../src/ts/utils/json-data";
import { Config as ConfigType } from "@oxytype/schemas/configs";

const WORDS_DIR = resolve(
  fileURLToPath(import.meta.url),
  "../../../../packages/typing-core/__fixtures__/words",
);

type GeneratorCase = {
  name: string;
  phase: string;
  seed: number;
  config: Partial<ConfigType>;
  customText?: typeof state.customText;
  repeat?: boolean;
  extraWords?: number;
  selectedQuoteId?: number;
};

const cases = JSON.parse(
  readFileSync(resolve(WORDS_DIR, "cases.json"), "utf-8"),
) as GeneratorCase[];

async function run(c: GeneratorCase): Promise<unknown> {
  Object.assign(getMutableConfig(), getDefaultConfig(), c.config);
  state.rng = state.seeded(c.seed);
  state.repeated = false;
  state.currentQuote = null;
  state.selectedQuoteId = c.selectedQuoteId ?? 1;
  if (c.customText !== undefined) {
    state.customText = structuredClone(c.customText);
  }

  const language = await JSONData.getLanguage(getMutableConfig().language);

  let gen = await WordsGenerator.generateWords(language);
  if (c.repeat === true) {
    state.repeated = true;
    gen = await WordsGenerator.generateWords(
      await JSONData.getLanguage(getMutableConfig().language),
    );
  }

  TestWords.words.reset();
  gen.words.forEach((word, i) => {
    TestWords.words.push(word, gen.sectionIndexes[i] as number);
  });

  const extra: unknown[] = [];
  for (let i = 0; i < (c.extraWords ?? 0); i++) {
    const next = await WordsGenerator.getNextWord(
      TestWords.words.length,
      100,
      TestWords.words.get(TestWords.words.length - 1)?.text ?? "",
      TestWords.words.get(TestWords.words.length - 2)?.text,
    );
    TestWords.words.push(next.word, next.sectionIndex);
    extra.push(next);
  }

  const quote = state.currentQuote as { id: number; group: number } | null;
  return {
    ...gen,
    extra,
    allWordsGenerated: WordsGenerator.areAllWordsGenerated(),
    currentQuote: quote === null ? null : { id: quote.id, group: quote.group },
  };
}

beforeEach(() => {
  TestWords.words.reset();
});

describe("words generator parity", () => {
  it.each(cases.map((c) => [c.name, c] as const))("%s", async (name, c) => {
    // json round trip on purpose: drops undefined just like the file
    const actual = JSON.parse(JSON.stringify(await run(c))) as unknown;
    const file = resolve(WORDS_DIR, "__snapshots__", `${name}.json`);
    if (process.env["UPDATE_PARITY_SNAPSHOTS"] === "1" || !existsSync(file)) {
      writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`);
    }
    expect(actual).toEqual(JSON.parse(readFileSync(file, "utf-8")));
  });
});
