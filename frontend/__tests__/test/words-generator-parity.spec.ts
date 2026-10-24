import { afterAll, describe, expect, it } from "vite-plus/test";
import "../__harness__/native-engine";
import { BrowserContent } from "@oxytype/typing-engine/browser.client";
import type { Prepare } from "@oxytype/typing-engine/browser.client";
import { projectEngineConfig } from "@oxytype/typing-engine/config";
import { encodeText, decodeText } from "@oxytype/typing-engine/text";
import {
  engineLanguage,
  engineQuotes,
} from "../../src/features/typing/runtime/content-assets.client";
import type { Config } from "@oxytype/schemas/configs";
import type { CustomTextSettings } from "@oxytype/schemas/results";
import type { LanguageObject } from "@oxytype/schemas/languages";
import type { QuoteData } from "@oxytype/schemas/quotes";
import { getDefaultConfig } from "../../src/ts/constants/default-config";

// The original snapshots are independent, immutable references. Test the actual
// web asset conversion and optimized Wasm, without retaining the old web engine.
const root = "../../../packages/typing-fixtures/reference/words";
const staticRoot = "../../static";
const fixtures = import.meta.glob(
  [
    "../../../packages/typing-fixtures/reference/words/**/*.json",
    "../../static/quotes/english.json",
    "../../static/languages/{english,english_1k,spanish,french,german,code_javascript,arabic,polish,swiss_german,turkish}.json",
  ],
  { eager: true, import: "default" },
);
function read<T>(path: string): T {
  const fixture = fixtures[path];
  if (fixture === undefined) throw new Error(`Missing parity fixture: ${path}`);
  return structuredClone(fixture) as T;
}
type Case = {
  name: string;
  seed: number;
  config: Partial<Config>;
  customText?: CustomTextSettings;
  repeat?: boolean;
  extraWords?: number;
  selectedQuoteId?: number;
};
const cases = read<Case[]>(`${root}/cases.json`);
const content = new BrowserContent();
let quotesLoaded = false;
afterAll(() => content.dispose());
function run(fixture: Case): unknown {
  const config = projectEngineConfig({
    ...getDefaultConfig(),
    ...fixture.config,
  });
  let quotes: Prepare["quotes"] = null;
  if (config.mode === "quote" && !quotesLoaded) {
    quotes = engineQuotes(read<QuoteData>(`${staticRoot}/quotes/english.json`));
    quotesLoaded = true;
  }
  content.prepare({
    config,
    language: engineLanguage(
      read<LanguageObject>(`${staticRoot}/languages/${config.language}.json`),
    ),
    custom:
      fixture.customText === undefined
        ? null
        : {
            ...fixture.customText,
            text: fixture.customText.text.map(encodeText),
          },
    random: { kind: "seeded", state: fixture.seed },
    quotes,
    polyglot: config.funbox.includes("polyglot")
      ? config.customPolyglot.map((name) =>
          engineLanguage(
            read<LanguageObject>(`${staticRoot}/languages/${name}.json`),
          ),
        )
      : [],
    selectedQuoteId: fixture.selectedQuoteId ?? 1,
    favoriteQuoteIds: [],
    sections: [],
  });
  let generated = content.generate();
  if (fixture.repeat === true) {
    generated = content.generate(true);
  }
  const words = generated.words.map(decodeText);
  const strip = (word: string): string =>
    /[ \n]$/.test(word) ? word.slice(0, -1) : word;
  const extra = [];
  for (let index = 0; index < (fixture.extraWords ?? 0); index++) {
    const next = content.next(
      words.length,
      100,
      encodeText(strip(words.at(-1) ?? "")),
      words.at(-2) === undefined
        ? null
        : encodeText(strip(words.at(-2) as string)),
    );
    words.push(decodeText(next.word));
    extra.push({
      ...next,
      word: decodeText(next.word),
      wordRaw: decodeText(next.wordRaw),
    });
  }
  const metadata = content.metadata();
  return {
    ...generated,
    words: generated.words.map(decodeText),
    extra,
    allWordsGenerated: metadata.allWordsGenerated,
    currentQuote:
      metadata.currentQuote === null
        ? null
        : { id: metadata.currentQuote.id, group: metadata.currentQuote.group },
  };
}
describe("native web generator parity", () => {
  it.each(cases)("$name", (fixture) => {
    const actual = JSON.parse(JSON.stringify(run(fixture))) as unknown;
    expect(actual).toEqual(
      read<unknown>(`${root}/__snapshots__/${fixture.name}.json`),
    );
  });
});
