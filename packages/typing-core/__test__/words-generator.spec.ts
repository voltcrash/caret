import { describe, it, expect, vi } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Config as ConfigType } from "@oxytype/schemas/configs";
import { Language, LanguageObject } from "@oxytype/schemas/languages";
import { QuoteWithTextSplit } from "../src/quotes";
import {
  createWordsGenerator,
  WordsGeneratorConfig,
  CustomTextSource,
} from "../src/words-generator";
import { QuotesController } from "../src/quote-source";
import {
  createFunboxWordFunctions,
  getWordFunboxes,
} from "../src/funbox-word-functions";
import * as LazyMode from "../src/lazy-mode";
import * as BritishEnglish from "../src/british-english";
import * as EnglishPunctuation from "../src/english-punctuation";
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
    currentQuote: null as QuoteWithTextSplit | null,
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

const STATIC_DIR = resolve(
  fileURLToPath(import.meta.url),
  "../../../../frontend/static",
);
function readStatic(path: string): unknown {
  return JSON.parse(
    readFileSync(resolve(STATIC_DIR, path.replace(/^\//, "")), "utf-8"),
  ) as unknown;
}
const getLanguage = async (language: Language): Promise<LanguageObject> =>
  readStatic(`languages/${language}.json`) as LanguageObject;
const defaults = {
  mode: "time",
  time: 30,
  words: 50,
  language: "english",
  punctuation: false,
  numbers: false,
  lazyMode: false,
  britishEnglish: false,
  showAllLines: false,
  quoteLength: [1],
  funbox: [],
  customPolyglot: ["english", "spanish", "french", "german"],
} satisfies WordsGeneratorConfig &
  Pick<ConfigType, "time" | "funbox" | "customPolyglot">;
let Config = { ...defaults } as typeof defaults &
  Pick<ConfigType, "funbox" | "customPolyglot">;
const quotes = new QuotesController({
  fetchJson: async (url) => readStatic(url),
  getSnapshot: () => null,
});
let words: string[] = [];
const functions = createFunboxWordFunctions({
  getConfig: () => Config,
  getLanguage,
  getPoem: async () => false,
  getSection: async () => false,
  disableFunbox: vi.fn(),
  setLanguage: vi.fn(),
});
const customText: CustomTextSource = {
  getText: () => state.customText.text,
  getMode: () =>
    state.customText.mode as ReturnType<CustomTextSource["getMode"]>,
  getLimitMode: () =>
    state.customText.limit.mode as ReturnType<CustomTextSource["getLimitMode"]>,
  getLimitValue: () => state.customText.limit.value,
  getPipeDelimiter: () => state.customText.pipeDelimiter,
};
const WordsGenerator = createWordsGenerator({
  getConfig: () => Config,
  getActiveFunboxes: () => getWordFunboxes(Config.funbox, functions),
  customText,
  quotes,
  transforms: {
    replaceAccents: LazyMode.replaceAccents,
    englishPunctuation: EnglishPunctuation,
    britishEnglish: async (word, previous) =>
      BritishEnglish.replace(word, previous, Config.mode),
  },
  isRepeated: () => state.repeated,
  isPractiseWordsActive: () => false,
  getCurrentQuote: () => state.currentQuote,
  setCurrentQuote: (quote) => {
    state.currentQuote = quote;
  },
  getSelectedQuoteId: () => state.selectedQuoteId,
  getWordsLength: () => words.length,
  setMode: vi.fn(),
  setQuoteLengthAll: vi.fn(),
  disableFunbox: vi.fn(),
});
const WORDS_DIR = resolve(
  fileURLToPath(import.meta.url),
  "../../__fixtures__/words",
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
  Config = { ...defaults, ...c.config } as typeof Config;
  words = [];
  state.rng = state.seeded(c.seed);
  state.repeated = false;
  state.currentQuote = null;
  state.selectedQuoteId = c.selectedQuoteId ?? 1;
  if (c.customText !== undefined) {
    state.customText = structuredClone(c.customText);
  }

  const language = await getLanguage(Config.language);

  let gen = await WordsGenerator.generateWords(language);
  if (c.repeat === true) {
    state.repeated = true;
    gen = await WordsGenerator.generateWords(
      await getLanguage(Config.language),
    );
  }

  words = [...gen.words];

  const extra: unknown[] = [];
  for (let i = 0; i < (c.extraWords ?? 0); i++) {
    const next = await WordsGenerator.getNextWord(
      words.length,
      100,
      words.at(-1)?.replace(/[ \n]$/, "") ?? "",
      words.at(-2)?.replace(/[ \n]$/, ""),
    );
    words.push(next.word);
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

describe("words generator parity", () => {
  it.each(cases.map((c) => [c.name, c] as const))("%s", async (name, c) => {
    // json round trip on purpose: drops undefined just like the file
    const actual = JSON.parse(JSON.stringify(await run(c))) as unknown;
    const file = resolve(WORDS_DIR, "__snapshots__", `${name}.json`);
    expect(actual).toEqual(JSON.parse(readFileSync(file, "utf-8")));
  });
});
