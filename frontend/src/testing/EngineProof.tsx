import type {
  BrowserSession,
  Config,
  Text,
  Prepare,
  Log,
  Query,
  Cursor,
  PolicyQuery,
} from "@caret/typing-engine/browser.client";
import type { WebLog } from "@caret/typing-engine/text";

import { createSignal, onCleanup } from "solid-js";

import {
  runContextProof,
  runRecoveryProof,
  runRestartsProof,
  runSourceFailuresProof,
} from "./engine-proof/content-runners";
import {
  runFixtureProof,
  runInitializationProof,
  runLifecycleProof,
  runLoadingProof,
  runPreparedProof,
} from "./engine-proof/session-runners";
import { errorMessage } from "./engine-proof/types";

export default function EngineProof() {
  const [fixture, setFixture] = createSignal("");
  const [result, setResult] = createSignal("");
  const [failure, setFailure] = createSignal("");
  const [benchmark, setBenchmark] = createSignal("");
  const [sliceInput, setSliceInput] = createSignal("");
  const [sliceEnded, setSliceEnded] = createSignal(false);
  let typingSession: BrowserSession | undefined;
  let disposed = false;
  const handles = new Set<BrowserSession>();
  const loaders = new Set<{ dispose: () => void }>();
  onCleanup(() => {
    disposed = true;
    for (const handle of handles) handle.dispose();
    handles.clear();
    for (const loader of loaders) loader.dispose();
    loaders.clear();
  });
  const executeProof = async (
    task: () => Promise<string | undefined>,
    guardFailureOnDispose = false,
  ): Promise<void> => {
    setResult("");
    setFailure("");
    try {
      const output = await task();
      if (output !== undefined && !disposed) {
        setResult(output);
      }
    } catch (error) {
      if (!guardFailureOnDispose || !disposed) {
        setFailure(errorMessage(error));
      }
    }
  };
  const run = async (): Promise<void> => {
    const rawFixture = fixture();
    await executeProof(async () =>
      runFixtureProof({
        fixture: rawFixture,
        isDisposed: () => disposed,
        handles,
        loaders,
        setBenchmark,
        replaceTypingSession: (create) => {
          typingSession?.dispose();
          typingSession = create();
          return typingSession;
        },
        resetSlice: () => {
          setSliceInput("");
          setSliceEnded(false);
        },
      }),
    );
  };
  const runLoading = async (): Promise<void> => {
    await executeProof(async () => runLoadingProof(() => disposed, loaders));
  };
  const runContext = async (): Promise<void> => {
    const rawFixture = fixture();
    await executeProof(async () => runContextProof(rawFixture, () => disposed));
  };
  const runRestarts = async (): Promise<void> => {
    const rawFixture = fixture();
    await executeProof(async () =>
      runRestartsProof(rawFixture, () => disposed),
    );
  };
  const runPolicies = async (): Promise<void> => {
    setResult("");
    setFailure("");
    try {
      const input = JSON.parse(fixture()) as {
        quick: {
          mode: string;
          words: number;
          time: number;
          limit: { mode: string; value: number };
          customIsLong: boolean;
        }[];
        quotes: { mode: string; repeatQuotes: string }[];
        quotePreparation: Prepare;
      };
      const { loadEngine } =
        await import("@caret/typing-engine/browser.client");
      const engine = await loadEngine();
      if (disposed) return;
      const quick = input.quick.map((item) => {
        const session = engine.createSession(item, [[97, 32]]);
        try {
          session.command({
            op: "customLimit",
            now: 0,
            mode: item.limit.mode,
            value: item.limit.value,
          });
          session.command({ op: "start", now: 0, date: 0 });
          return session.restartPolicy({
            quick: true,
            customIsLong: item.customIsLong,
          }).allowed;
        } finally {
          session.dispose();
        }
      });
      const quotes = input.quotes.map((item) => {
        const content = engine.createContent();
        let session: BrowserSession | undefined;
        try {
          if (item.mode === "quote") {
            content.prepare({
              ...input.quotePreparation,
              config: { ...input.quotePreparation.config, ...item },
            });
            session = content.createSession();
          } else {
            session = engine.createSession(item, [[97, 32]]);
          }
          session.command({ op: "start", now: 0, date: 0 });
          return session.restartPolicy().withSameWordset;
        } finally {
          session?.dispose();
          content.dispose();
        }
      });
      setResult(JSON.stringify({ quick, quotes }));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  };
  const runInitialization = async (): Promise<void> => {
    await executeProof(
      async () => runInitializationProof(() => disposed),
      true,
    );
  };
  const runLifecycle = async (): Promise<void> => {
    const rawFixture = fixture();
    await executeProof(
      async () => runLifecycleProof(rawFixture, () => disposed),
      true,
    );
  };
  const runSourceFailures = async (): Promise<void> => {
    const rawFixture = fixture();
    await executeProof(async () =>
      runSourceFailuresProof(rawFixture, () => disposed),
    );
  };
  const runRecovery = async (): Promise<void> => {
    const rawFixture = fixture();
    await executeProof(async () =>
      runRecoveryProof(rawFixture, () => disposed),
    );
  };
  const runQuoteCatalog = async (): Promise<void> => {
    setResult("");
    setFailure("");
    try {
      const input = JSON.parse(fixture()) as {
        asset: NonNullable<Prepare["quotes"]>;
        stages: { british: boolean }[];
      };
      const { loadEngine } =
        await import("@caret/typing-engine/browser.client");
      const engine = await loadEngine();
      if (disposed) return;
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
        setResult(JSON.stringify(results));
      } finally {
        content.dispose();
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  };
  const runQuoteQueue = async (): Promise<void> => {
    setResult("");
    setFailure("");
    try {
      const reference = JSON.parse(fixture()) as {
        asset: { quotes: { text: string }[] };
        cycles: { lengths: number[]; selected: unknown[] }[];
      };
      const { loadEngine, encodeText } =
        await import("@caret/typing-engine/browser.client");
      const engine = await loadEngine();
      if (disposed) return;
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
        setResult(JSON.stringify({ initialId, cycles }));
      } finally {
        content.dispose();
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  };
  const runSettingPolicies = async (): Promise<void> => {
    setResult("");
    setFailure("");
    try {
      const cases = JSON.parse(fixture()) as {
        combinations: { names: string[] }[];
        forced: {
          names: string[];
          key: string;
          value: Extract<PolicyQuery, { op: "forced" }>["value"];
        }[];
      };
      const { loadEngine } =
        await import("@caret/typing-engine/browser.client");
      const engine = await loadEngine();
      if (disposed) return;
      setResult(
        JSON.stringify({
          combinations: cases.combinations.map(
            ({ names }) => engine.policy({ op: "compatible", names }).result,
          ),
          forced: cases.forced.map((input) => ({
            forced: engine.policy({ op: "forced", ...input }).result,
            canSet: engine.policy({ op: "canSet", ...input }).result,
          })),
        }),
      );
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  };
  const runLiveGeneration = async (): Promise<void> => {
    setResult("");
    setFailure("");
    try {
      const input = JSON.parse(fixture()) as {
        input: Prepare;
        steps: { config: Config; extra: unknown[] }[];
      };
      const { loadEngine } =
        await import("@caret/typing-engine/browser.client");
      const engine = await loadEngine();
      if (disposed) return;
      const content = engine.createContent();
      try {
        content.prepare(input.input);
        const generated = content.generate();
        const words = [...generated.words];
        const strip = (word: Text | undefined): Text | null =>
          word === undefined
            ? null
            : [32, 10].includes(word.at(-1) ?? -1)
              ? word.slice(0, -1)
              : word;
        const steps = input.steps.map((step) => {
          content.configure(step.config);
          return step.extra.map(() => {
            const next = content.next(
              words.length,
              100,
              strip(words.at(-1)),
              strip(words.at(-2)),
            );
            words.push(next.word);
            return next;
          });
        });
        setResult(JSON.stringify({ generated, steps }));
      } finally {
        content.dispose();
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  };
  const runGeneration = async (): Promise<void> => {
    setResult("");
    setFailure("");
    try {
      const cases = JSON.parse(fixture()) as {
        input: Prepare;
        repeat?: boolean;
        extraWords?: number;
      }[];
      const { loadEngine } =
        await import("@caret/typing-engine/browser.client");
      const engine = await loadEngine();
      if (disposed) return;
      const content = engine.createContent();
      try {
        const results = cases.map(({ input, repeat, extraWords }) => {
          content.prepare(input);
          let generated = content.generate();
          if (repeat === true) generated = content.generate(true);
          const words = [...generated.words];
          const extra = [];
          const strip = (word: Text | undefined): Text | null =>
            word === undefined
              ? null
              : [32, 10].includes(word.at(-1) ?? -1)
                ? word.slice(0, -1)
                : word;
          for (let index = 0; index < (extraWords ?? 0); index++) {
            const next = content.next(
              words.length,
              100,
              strip(words.at(-1)),
              strip(words.at(-2)),
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
        setResult(JSON.stringify(results));
      } finally {
        content.dispose();
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  };
  const runAnalysis = async (): Promise<void> => {
    setResult("");
    setFailure("");
    try {
      const inputs = JSON.parse(fixture()) as {
        log?: Log;
        webLog?: WebLog;
        queries: Query[];
        playback?: { zen: boolean; targets: Cursor[] }[];
      }[];
      const { loadEngine, analyzeLog, toEngineLog, toWebLog } =
        await import("@caret/typing-engine/browser.client");
      const engine = await loadEngine();
      if (disposed) return;
      setResult(
        JSON.stringify(
          inputs.map(({ log: neutral, webLog, queries, playback }) => {
            const log = webLog === undefined ? neutral : toEngineLog(webLog);
            if (log === undefined) throw new Error("Missing analysis log");
            const analysis = queries.map((query) => analyzeLog(log, query));
            if (playback === undefined) {
              return webLog === undefined
                ? analysis
                : { analysis, roundTrip: toWebLog(log) };
            }
            return {
              analysis,
              ...(webLog === undefined ? {} : { roundTrip: toWebLog(log) }),
              playback: playback.map(({ zen, targets }) => {
                const replay = engine.createReplay(log, zen);
                try {
                  const initial = replay.snapshot();
                  const words = initial.words;
                  const sounds = [];
                  let cursor = initial.cursor;
                  let next = initial.nextTime;
                  while (next !== null) {
                    const update = replay.step();
                    for (const change of update.words) {
                      words[change.index] = change.word;
                    }
                    sounds.push(update.sound);
                    cursor = update.cursor;
                    next = update.nextTime;
                  }
                  const seeks = targets.map((target) => {
                    const snapshot = replay.seek(target);
                    return {
                      words: snapshot.words,
                      cursor: snapshot.cursor,
                      nextIndex: snapshot.nextIndex,
                    };
                  });
                  replay.dispose();
                  replay.dispose();
                  let stale = false;
                  try {
                    replay.step();
                  } catch {
                    stale = true;
                  }
                  return { words, sounds, cursor, seeks, stale };
                } finally {
                  replay.dispose();
                }
              }),
            };
          }),
        ),
      );
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  };
  const runPrepared = async (): Promise<void> => {
    const rawFixture = fixture();
    await executeProof(async () =>
      runPreparedProof(rawFixture, () => disposed, handles),
    );
  };
  return (
    <main class="p-4">
      <textarea
        aria-label="Command fixture"
        value={fixture()}
        onInput={(event) => setFixture(event.currentTarget.value)}
      ></textarea>
      <button
        type="button"
        onClick={() => {
          void run();
        }}
      >
        Run fixture
      </button>
      <button
        type="button"
        onClick={() => {
          void runQuoteQueue();
        }}
      >
        Run quote queue
      </button>
      <button
        type="button"
        onClick={() => {
          void runQuoteCatalog();
        }}
      >
        Run quote catalog
      </button>
      <button
        type="button"
        onClick={() => {
          void runSettingPolicies();
        }}
      >
        Run setting policies
      </button>
      <button
        type="button"
        onClick={() => {
          void runLiveGeneration();
        }}
      >
        Run live generation
      </button>
      <button
        type="button"
        onClick={() => {
          void runGeneration();
        }}
      >
        Run generation
      </button>
      <button
        type="button"
        onClick={() => {
          void runAnalysis();
        }}
      >
        Run analysis
      </button>
      <button
        type="button"
        onClick={() => {
          void runPrepared();
        }}
      >
        Run prepared session
      </button>
      <button
        type="button"
        onClick={() => {
          void runLoading();
        }}
      >
        Run loading
      </button>
      <button
        type="button"
        onClick={() => {
          void runContext();
        }}
      >
        Run context
      </button>
      <button
        type="button"
        onClick={() => {
          void runRestarts();
        }}
      >
        Run restarts
      </button>
      <button
        type="button"
        onClick={() => {
          void runPolicies();
        }}
      >
        Run policies
      </button>
      <button
        type="button"
        onClick={() => {
          void runInitialization();
        }}
      >
        Run initialization
      </button>
      <button
        type="button"
        onClick={() => {
          void runLifecycle();
        }}
      >
        Run lifecycle
      </button>
      <button
        type="button"
        onClick={() => {
          void runSourceFailures();
        }}
      >
        Run source failures
      </button>
      <button
        type="button"
        onClick={() => {
          void runRecovery();
        }}
      >
        Run recovery
      </button>
      <pre data-testid="engine-proof-result">{result()}</pre>
      <pre data-testid="engine-proof-error">{failure()}</pre>
      <pre data-testid="engine-proof-benchmark">{benchmark()}</pre>
      <input
        aria-label="Type finite slice"
        value={sliceInput()}
        onBeforeInput={(event) => {
          event.preventDefault();
          if (typingSession === undefined) return;
          const observation = event as InputEvent;
          if (observation.data === null) return;
          const data = Array.from(
            { length: observation.data.length },
            (_, index) => observation.data?.charCodeAt(index) ?? 0,
          );
          const update = typingSession.command({
            op: "insert",
            data,
            now: performance.now(),
            date: Date.now(),
            automatic: null,
            correctShiftUsed: null,
            isCompositionEnding: null,
          });
          setSliceInput(String.fromCharCode(...update.state.inputValue));
          setSliceEnded(update.state.ended);
        }}
      />
      <output aria-label="Finite slice state">
        {sliceEnded() ? "finished" : sliceInput()}
      </output>
    </main>
  );
}
