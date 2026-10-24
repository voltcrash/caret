import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Config, FunboxName } from "@oxytype/schemas/configs";
import type { LanguageObject } from "@oxytype/schemas/languages";
const units = (value: string): number[] =>
  Array.from({ length: value.length }, (_, i) => value.charCodeAt(i));
const seeded =
  (seed: number): (() => number) =>
  () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
const original = Math.random;
let random = seeded(1);
Math.random = () => random();
try {
  const { createWordsGenerator } = await import("../src/words-generator");
  const { createFunboxWordFunctions, getWordFunboxes } =
    await import("../src/funbox-word-functions");
  const { getDefaultConfig } = await import("../src/config/default-config");
  const { QuotesController } = await import("../src/quote-source");
  const { getPoem } = await import("../src/poetry");
  const { getSection } = await import("../src/wikipedia");
  const lazy = await import("../src/lazy-mode");
  const british = await import("../src/british-english");
  const english = await import("../src/english-punctuation");
  const references = [];
  for (const [name, kind, time, repeat, randomCase] of [
    ["poetry-finite", "poetry", false, false, false],
    ["article-finite", "wikipedia", false, false, false],
    ["poetry-repeat", "poetry", false, true, false],
    ["poetry-random-case", "poetry", false, false, true],
    ["article-time", "wikipedia", true, false, false],
  ] as const) {
    random = seeded(91);
    let repeated = false;
    let counter = 0;
    let words: string[] = [];
    const sources: unknown[] = [];
    const language = {
      name: "english",
      words: ["one", "two", "three", "four"],
    } as LanguageObject;
    const config: Config = {
      ...getDefaultConfig(),
      mode: time ? "time" : "words",
      words: 12,
      punctuation: true,
      lazyMode: true,
      funbox: [kind, ...(randomCase ? ["rAnDoMcAsE" as FunboxName] : [])],
    };
    const pull = async (): Promise<import("../src/languages").Section> => {
      const index = counter++;
      const title = `Section ${index}`;
      const author = "Author";
      if (kind === "poetry") {
        const lines = [`Section${index} naïve TWO three`];
        sources.push({
          kind: "poem",
          title: units(title),
          author: units(author),
          lines: lines.map(units),
        });
        const result = await getPoem(async () => [{ title, author, lines }]);
        if (result === false) throw new Error("Missing poem");
        return result;
      }
      const text = time
        ? Array.from({ length: 100 }, (_, i) => `Word${index}_${i}`).join(" ")
        : `Section${index} naïve… TWO three`;
      sources.push({
        kind: "article",
        title: units(title),
        author: units(author),
        plainText: units(text),
      });
      return getSection("english", {
        getLanguage: async () => ({ ...language, bcp47: "en" }),
        fetchJson: async (url) =>
          url.includes("/w/api.php")
            ? { query: { pages: { "1": { extract: "unused" } } } }
            : { title, author, pageid: 1 },
        htmlToText: () => text,
      });
    };
    const functions = createFunboxWordFunctions({
      getConfig: () => config,
      getLanguage: async () => language,
      getPoem: pull,
      getSection: pull,
      disableFunbox: () => undefined,
      setLanguage: () => undefined,
    });
    const generator = createWordsGenerator({
      getConfig: () => config,
      getActiveFunboxes: () => getWordFunboxes(config.funbox, functions),
      customText: {
        getText: () => [],
        getMode: () => "repeat",
        getLimitMode: () => "word",
        getLimitValue: () => 0,
        getPipeDelimiter: () => false,
      },
      quotes: new QuotesController({
        fetchJson: async () => {
          throw new Error("Unexpected quote");
        },
        getSnapshot: () => null,
      }),
      transforms: {
        replaceAccents: lazy.replaceAccents,
        englishPunctuation: english,
        britishEnglish: async (word, previous) =>
          british.replace(word, previous, config.mode),
      },
      isRepeated: () => repeated,
      isPractiseWordsActive: () => false,
      getCurrentQuote: () => null,
      setCurrentQuote: () => undefined,
      getSelectedQuoteId: () => 1,
      getWordsLength: () => words.length,
      setMode: () => undefined,
      setQuoteLengthAll: () => undefined,
      disableFunbox: () => undefined,
    });
    let generated = await generator.generateWords(language);
    words = [...generated.words];
    if (repeat) {
      repeated = true;
      generated = await generator.generateWords(language);
      words = [...generated.words];
    }
    const extra = [];
    for (let i = 0; i < (time ? 3 : 0); i++) {
      const next = await generator.getNextWord(
        words.length,
        100,
        words.at(-1)?.replace(/[ \n]$/, ""),
        words.at(-2)?.replace(/[ \n]$/, ""),
      );
      words.push(next.word);
      extra.push({
        ...next,
        word: units(next.word),
        wordRaw: units(next.wordRaw),
      });
    }
    references.push({
      name,
      config,
      language: { name: "english", words: language.words.map(units) },
      seed: 91,
      sources,
      repeat,
      expected: {
        ...generated,
        words: generated.words.map(units),
        extra,
        allWordsGenerated: generator.areAllWordsGenerated(),
      },
      randomTail: random(),
    });
  }
  writeFileSync(
    resolve(
      import.meta.dirname,
      "../../typing-fixtures/oracle/section-generation.json",
    ),
    `${JSON.stringify(references, null, 2)}\n`,
    { flag: "wx" },
  );
} finally {
  Math.random = original;
}
