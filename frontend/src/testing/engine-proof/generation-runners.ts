import type { Config, Prepare } from "@caret/typing-engine/browser.client";

import { stripWordTrailingWhitespace } from "./types";

export async function runQuoteCatalogProof(
  fixture: string,
  isDisposed: () => boolean,
): Promise<string | undefined> {
  const input = JSON.parse(fixture) as {
    asset: NonNullable<Prepare["quotes"]>;
    stages: { british: boolean }[];
  };
  const { loadEngine } = await import("@caret/typing-engine/browser.client");
  const engine = await loadEngine();
  if (isDisposed()) return undefined;
  const content = engine.createContent();
  try {
    content.quoteCatalog(input.asset, [-2], { kind: "seeded", state: 11 });
    const results = input.stages.map(({ british }) => {
      content.prepare({
        config: {
          mode: "quote",
          language: "swiss_german",
          quoteLength: [-2],
          britishEnglish: british,
        },
        language: { name: "swiss_german", words: [[97]] },
        quotes: null,
        random: { kind: "seeded", state: 11 },
        selectedQuoteId: 1,
      } as Prepare);
      const currentQuote = content.metadata().currentQuote;
      const collection = content.quoteCatalog(input.asset, null, {
        kind: "seeded",
        state: 11,
      });
      return {
        currentQuote,
        words: currentQuote?.textSplit,
        collection: {
          ...collection,
          groups: collection.groups.map((group) =>
            group.map((index) => collection.quotes[index]),
          ),
        },
      };
    });
    return JSON.stringify(results);
  } finally {
    content.dispose();
  }
}

export async function runQuoteQueueProof(
  fixture: string,
  isDisposed: () => boolean,
): Promise<string | undefined> {
  const reference = JSON.parse(fixture) as {
    asset: { quotes: { text: string }[] };
    cycles: { lengths: number[]; selected: unknown[] }[];
  };
  const { loadEngine, encodeText } =
    await import("@caret/typing-engine/browser.client");
  const engine = await loadEngine();
  if (isDisposed()) return undefined;
  const content = engine.createContent();
  const asset = {
    ...reference.asset,
    quotes: reference.asset.quotes.map((quote) => ({
      ...quote,
      text: encodeText(quote.text),
    })),
  };
  const preparation = (lengths: number[], quotes: unknown): Prepare =>
    ({
      config: { mode: "quote", quoteLength: lengths },
      language: { name: "english", words: [[97]] },
      quotes,
      random: { kind: "seeded", state: 91 },
    }) as Prepare;
  try {
    content.prepare(preparation([0], asset));
    const initialId = content.metadata().currentQuote?.id;
    const cycles = reference.cycles.map((cycle) => {
      const random = content.updateQuoteQueue(cycle.lengths, {
        kind: "seeded",
        state: 91,
      });
      const selected = cycle.selected.map(() => {
        content.prepare(preparation(cycle.lengths, null));
        return content.metadata().currentQuote?.id;
      });
      return { random, selected };
    });
    return JSON.stringify({ initialId, cycles });
  } finally {
    content.dispose();
  }
}

export async function runLiveGenerationProof(
  fixture: string,
  isDisposed: () => boolean,
): Promise<string | undefined> {
  const input = JSON.parse(fixture) as {
    input: Prepare;
    steps: { config: Config; extra: unknown[] }[];
  };
  const { loadEngine } = await import("@caret/typing-engine/browser.client");
  const engine = await loadEngine();
  if (isDisposed()) return undefined;
  const content = engine.createContent();
  try {
    content.prepare(input.input);
    const generated = content.generate();
    const words = [...generated.words];
    const steps = input.steps.map((step) => {
      content.configure(step.config);
      return step.extra.map(() => {
        const next = content.next(
          words.length,
          100,
          stripWordTrailingWhitespace(words.at(-1)),
          stripWordTrailingWhitespace(words.at(-2)),
        );
        words.push(next.word);
        return next;
      });
    });
    return JSON.stringify({ generated, steps });
  } finally {
    content.dispose();
  }
}

export async function runGenerationProof(
  fixture: string,
  isDisposed: () => boolean,
): Promise<string | undefined> {
  const cases = JSON.parse(fixture) as {
    input: Prepare;
    repeat?: boolean;
    extraWords?: number;
  }[];
  const { loadEngine } = await import("@caret/typing-engine/browser.client");
  const engine = await loadEngine();
  if (isDisposed()) return undefined;
  const content = engine.createContent();
  try {
    const results = cases.map(({ input, repeat, extraWords }) => {
      content.prepare(input);
      let generated = content.generate();
      if (repeat === true) generated = content.generate(true);
      const words = [...generated.words];
      const extra = [];
      for (let index = 0; index < (extraWords ?? 0); index++) {
        const next = content.next(
          words.length,
          100,
          stripWordTrailingWhitespace(words.at(-1)),
          stripWordTrailingWhitespace(words.at(-2)),
        );
        words.push(next.word);
        extra.push(next);
      }
      const metadata = content.metadata();
      return {
        ...generated,
        extra,
        allWordsGenerated: metadata.allWordsGenerated,
        currentQuote:
          metadata.currentQuote === null
            ? null
            : {
                id: metadata.currentQuote.id,
                group: metadata.currentQuote.group,
              },
      };
    });
    return JSON.stringify(results);
  } finally {
    content.dispose();
  }
}
