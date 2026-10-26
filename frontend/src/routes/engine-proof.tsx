import type {
  BrowserSession,
  Command,
  Config,
  Text,
  Prepare,
  Log,
  Query,
  Source,
  ContentRequest,
  Update,
  Cursor,
  PaceCommand,
  PolicyQuery,
} from "@caret/typing-engine/browser.client";
import type { WebLog } from "@caret/typing-engine/text";

import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, onCleanup, Show } from "solid-js";

export const Route = createFileRoute("/engine-proof")({
  component: EngineProof,
});

// Build-time opt-in test harness. Regular deployment exposes no runnable harness.
function EngineProof() {
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
  const run = async (): Promise<void> => {
    setResult("");
    setFailure("");
    try {
      const input = JSON.parse(fixture()) as {
        name: string;
        config: Partial<Config>;
        words: Text[];
        commands: Command[];
      };
      const started = performance.now();
      const { loadEngine, benchmarkBoundary, encodeText } =
        await import("@caret/typing-engine/browser.client");
      const engine = await loadEngine();
      if (disposed) return;
      const initializationMs = performance.now() - started;
      typingSession?.dispose();
      typingSession = engine.createSession({ mode: "words", words: 2 }, [
        encodeText("one "),
        encodeText("two"),
      ]);
      handles.add(typingSession);
      setSliceInput("");
      setSliceEnded(false);
      const session = engine.createSession(input.config, input.words);
      const isolated = engine.createSession(input.config, input.words);
      handles.add(session);
      handles.add(isolated);
      const untouched = JSON.stringify(isolated.log());
      const frames = input.commands.map((command) => ({
        state: session.command(command).state,
        log: session.log(),
      }));
      if (untouched !== JSON.stringify(isolated.log())) {
        throw new Error("Session isolation failed");
      }
      session.dispose();
      session.dispose();
      let staleRejected = false;
      try {
        session.log();
      } catch {
        staleRejected = true;
      }
      if (!staleRejected) throw new Error("Stale session accepted");
      isolated.dispose();
      handles.delete(session);
      handles.delete(isolated);
      const recreated = engine.createSession(input.config, input.words);
      recreated.dispose();
      setBenchmark(
        JSON.stringify({
          initializationMs,
          ...benchmarkBoundary(),
          memoryBytes: engine.memoryBytes(),
        }),
      );
      setResult(JSON.stringify({ name: input.name, frames }));
    } catch (error) {
      for (const handle of handles) handle.dispose();
      handles.clear();
      setFailure(error instanceof Error ? error.message : String(error));
    }
  };
  const runLoading = async (): Promise<void> => {
    setResult("");
    setFailure("");
    const { createEngineLoader, loadEngine, encodeText } =
      await import("@caret/typing-engine/browser.client");
    const loader = createEngineLoader();
    const sessions: BrowserSession[] = [];
    loaders.add(loader);
    try {
      let recovered = false;
      try {
        await loader.load();
      } catch {
        recovered = true;
      }
      const first = loader.load();
      const shared = first === loader.load();
      await Promise.all(
        [first, ...Array.from({ length: 4 }, async () => loadEngine())].map(
          async (ready) => {
            const engine = await ready;
            if (disposed) return;
            const session = engine.createSession({ mode: "words", words: 0 }, [
              encodeText("one "),
            ]);
            sessions.push(session);
            session.command({
              op: "insert",
              data: encodeText("o"),
              now: 0,
              date: 0,
              automatic: null,
              isCompositionEnding: null,
              correctShiftUsed: null,
            });
          },
        ),
      );
      const intact =
        sessions.length === 5 &&
        sessions.every(
          (session) =>
            JSON.stringify(session.snapshot().state.inputValue) === "[111]",
        );
      loader.dispose();
      let rejected = false;
      try {
        await loader.load();
      } catch {
        rejected = true;
      }
      if (!disposed) {
        setResult(JSON.stringify({ recovered, shared, intact, rejected }));
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      for (const session of sessions) session.dispose();
      loader.dispose();
      loaders.delete(loader);
    }
  };
  const runContext = async (): Promise<void> => {
    setResult("");
    setFailure("");
    try {
      const input = JSON.parse(fixture()) as {
        pace: { targets: Text[]; frames: { command: PaceCommand }[] };
        normalization: { language: string; data: Text; target: Text }[];
        learning: Prepare;
      };
      const { loadEngine, encodeText } =
        await import("@caret/typing-engine/browser.client");
      const engine = await loadEngine();
      if (disposed) return;
      const pace = engine.createSession(
        { mode: "words", words: 0 },
        input.pace.targets,
      );
      const content = engine.createContent();
      const isolated = engine.createContent();
      const sessions: BrowserSession[] = [pace];
      try {
        const frames = input.pace.frames.map(({ command }) =>
          pace.pace(command),
        );
        const normalization = input.normalization.map((item) => {
          const session = engine.createSession({ language: item.language }, [
            item.target,
          ]);
          try {
            return session.preflight(item.data).normalized;
          } finally {
            session.dispose();
          }
        });
        content.prepare(input.learning);
        const first = content.createSession();
        sessions.push(first);
        first.command({
          op: "insert",
          data: encodeText("a"),
          now: 0,
          date: 0,
          automatic: null,
          isCompositionEnding: null,
          correctShiftUsed: null,
        });
        first.command({
          op: "insert",
          data: encodeText("x"),
          now: 100,
          date: 100,
          automatic: null,
          isCompositionEnding: null,
          correctShiftUsed: null,
        });
        first.pace({ op: "remember", wpm: 77, repeating: false });
        first.pace({ op: "remember", wpm: 40, repeating: true });
        content.recycleSession(first);
        let stale = false;
        try {
          first.snapshot();
        } catch {
          stale = true;
        }
        content.prepare(input.learning);
        const next = content.createSession();
        sessions.push(next);
        isolated.prepare(input.learning);
        const fresh = isolated.createSession();
        sessions.push(fresh);
        setResult(
          JSON.stringify({
            frames,
            normalization,
            stale,
            learnedWords: next.snapshot().words,
            freshWords: fresh.snapshot().words,
            remembered: next.pace({ op: "reset", wpm: null }).lastWpm,
            isolated: fresh.pace({ op: "reset", wpm: null }).lastWpm,
            emptyLog: next.log().events.length === 0,
            active: next.snapshot().state.active,
          }),
        );
      } finally {
        for (const session of sessions) session.dispose();
        content.dispose();
        isolated.dispose();
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  };
  const runRestarts = async (): Promise<void> => {
    setResult("");
    setFailure("");
    try {
      const input = JSON.parse(fixture()) as {
        words: Prepare;
        quote: Prepare;
        sections: Prepare;
      };
      const { loadEngine } =
        await import("@caret/typing-engine/browser.client");
      const engine = await loadEngine();
      if (disposed) return;
      const owners = Array.from({ length: 3 }, () => engine.createContent());
      const sessions: BrowserSession[] = [];
      const [words, quote, sections] = owners;
      if (
        words === undefined ||
        quote === undefined ||
        sections === undefined
      ) {
        throw new Error("Missing owner");
      }
      try {
        words.prepare(input.words);
        const first = words.createSession();
        sessions.push(first);
        const before = first.snapshot().words;
        words.recycleSession(first);
        words.prepare(
          { ...input.words, random: { kind: "seeded", state: 99 } },
          true,
        );
        const repeated = words.createSession(true);
        sessions.push(repeated);
        const after = repeated.snapshot().words;
        quote.prepare(input.quote);
        const firstQuote = quote.createSession();
        sessions.push(firstQuote);
        const quoteBefore = firstQuote.snapshot();
        quote.recycleSession(firstQuote);
        quote.prepare({ ...input.quote, quotes: null }, true);
        const repeatQuote = quote.createSession(true);
        sessions.push(repeatQuote);
        const quoteAfter = repeatQuote.snapshot();
        quote.recycleSession(repeatQuote);
        quote.prepare({ ...input.quote, quotes: null });
        const nextQuote = quote.createSession();
        sessions.push(nextQuote);
        sections.prepare(input.sections);
        try {
          sections.createSession();
        } catch {
          /* Expected typed source request. */
        }
        const old = sections.request();
        sections.prepare(input.sections);
        try {
          sections.createSession();
        } catch {
          /* Expected replacement request. */
        }
        const current = sections.request();
        if (old === null || current === null) {
          throw new Error("Missing request");
        }
        let staleRejected = false;
        try {
          sections.supply(old, {
            kind: "poem",
            title: [],
            author: [],
            lines: [[111, 110, 101]],
          });
        } catch {
          staleRejected = true;
        }
        setResult(
          JSON.stringify({
            before,
            after,
            quoteBefore: {
              words: quoteBefore.words,
              quote: quoteBefore.currentQuote,
            },
            quoteAfter: {
              words: quoteAfter.words,
              quote: quoteAfter.currentQuote,
            },
            nextQuote: nextQuote.snapshot().currentQuote,
            old,
            current,
            staleRejected,
            pending: sections.request(),
          }),
        );
      } finally {
        for (const session of sessions) session.dispose();
        for (const owner of owners) owner.dispose();
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
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
    setResult("");
    setFailure("");
    const started = performance.now();
    try {
      const { loadEngine } =
        await import("@caret/typing-engine/browser.client");
      const engine = await loadEngine();
      if (disposed) return;
      const session = engine.createSession({ mode: "words", words: 1 }, [[97]]);
      try {
        const update = session.command({
          op: "insert",
          data: [97],
          now: 0,
          date: 0,
          automatic: null,
          correctShiftUsed: null,
          isCompositionEnding: null,
        });
        if (!update.state.ended) {
          throw new Error("Initialization did not produce a usable engine");
        }
        setResult(
          JSON.stringify({
            initializationMs: performance.now() - started,
            memory: engine.memoryBytes(),
          }),
        );
      } finally {
        session.dispose();
      }
    } catch (error) {
      if (!disposed) {
        setFailure(error instanceof Error ? error.message : String(error));
      }
    }
  };
  const runLifecycle = async (): Promise<void> => {
    setResult("");
    setFailure("");
    try {
      const { runEngineLifecycle } =
        await import("../testing/engine-lifecycle.client");
      const options =
        fixture() === "" ? {} : (JSON.parse(fixture()) as { words?: number });
      const output = await runEngineLifecycle(() => !disposed, options.words);
      if (!disposed) setResult(JSON.stringify(output));
    } catch (error) {
      if (!disposed) {
        setFailure(error instanceof Error ? error.message : String(error));
      }
    }
  };
  const runSourceFailures = async (): Promise<void> => {
    setResult("");
    setFailure("");
    try {
      const { loadEngine, EngineFailure, encodeText } =
        await import("@caret/typing-engine/browser.client");
      const engine = await loadEngine();
      if (disposed) return;
      const refs = JSON.parse(fixture()) as { kind: string }[];
      const output = [];
      const preparation = (
        kind: string,
        sections: Prepare["sections"],
      ): Prepare =>
        ({
          config: { mode: "time", time: 0, funbox: [kind] },
          language: { name: "english", words: [encodeText("base")] },
          random: { kind: "seeded", state: 1 },
          sections,
        }) as Prepare;
      for (const ref of refs) {
        const content = engine.createContent();
        try {
          content.prepare(preparation(ref.kind, []));
          try {
            content.createSession();
          } catch (error) {
            if (
              !(error instanceof EngineFailure) ||
              error.code !== "contentRequired"
            ) {
              throw error;
            }
          }
          const request = content.request();
          if (request === null) throw new Error("Missing initial request");
          try {
            content.failSource(request);
          } catch (error) {
            if (
              !(error instanceof EngineFailure) ||
              error.code !== "sourceUnavailable"
            ) {
              throw error;
            }
            output.push({ message: error.message, recovery: error.recovery });
          }
        } finally {
          content.dispose();
        }
      }
      const active = [];
      for (const exhausted of [false, true]) {
        const content = engine.createContent();
        let session: BrowserSession | undefined;
        try {
          const source = {
            kind: "poem" as const,
            title: [],
            author: [],
            lines: [encodeText("one ".repeat(100))],
          };
          content.prepare(preparation("poetry", [source]));
          session = content.createSession();
          const waiting = session.command({
            op: "insert",
            data: encodeText("one ".repeat(exhausted ? 101 : 1)),
            correctShiftUsed: null,
            automatic: null,
            isCompositionEnding: null,
            now: 0,
            date: 0,
          });
          if (waiting.contentRequest === undefined) {
            throw new Error("Missing active request");
          }
          const before = JSON.stringify(session.log());
          let recovery;
          try {
            session.command({
              op: "failContent",
              now: 10,
              request: waiting.contentRequest,
            });
          } catch (error) {
            if (
              !(error instanceof EngineFailure) ||
              error.code !== "sourceUnavailable"
            ) {
              throw error;
            }
            recovery = error.recovery;
          }
          session.command({
            op: "insert",
            now: 20,
            date: 0,
            data: encodeText("discarded"),
            correctShiftUsed: null,
            automatic: null,
            isCompositionEnding: null,
          });
          session.command({ op: "advance", now: 5000, date: 0 });
          const preserved = before === JSON.stringify(session.log());
          const state = session.snapshot().state;
          let stale = false;
          try {
            session.command({
              op: "supplyContent",
              now: 5001,
              date: 0,
              request: waiting.contentRequest,
              source,
            });
          } catch (error) {
            stale =
              error instanceof EngineFailure && error.code === "staleRequest";
          }
          session.command({ op: "abandon", now: 5010, date: 9000 });
          active.push({
            recovery,
            preserved,
            awaitingRecovery: state.awaitingRecovery,
            failed: state.reason !== undefined,
            stale,
            ended: session.snapshot().state.ended,
          });
        } finally {
          session?.dispose();
          content.dispose();
        }
      }
      setResult(JSON.stringify({ initial: output, active }));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  };
  const runRecovery = async (): Promise<void> => {
    setResult("");
    setFailure("");
    try {
      const inputs = JSON.parse(fixture()) as { input: Prepare }[];
      const { loadEngine, EngineFailure } =
        await import("@caret/typing-engine/browser.client");
      const engine = await loadEngine();
      if (disposed) return;
      const results = inputs.map(({ input }) => {
        const content = engine.createContent();
        let session: BrowserSession | undefined;
        try {
          let failure: InstanceType<typeof EngineFailure> | undefined;
          try {
            content.prepare(input);
          } catch (error) {
            if (!(error instanceof EngineFailure)) throw error;
            failure = error;
          }
          if (failure === undefined) {
            throw new Error("Expected typed preparation failure");
          }
          content.prepare({
            ...input,
            config: { ...input.config, mode: "words", words: 2, funbox: [] },
            language: {
              ...input.language,
              name: "english",
              words: [[97], [98]],
            },
            quotes: null,
            polyglot: [],
          });
          session = content.createSession();
          const recovered = session.snapshot().words.length === 2;
          const log = JSON.stringify(session.log());
          let invalidCode: string | undefined;
          try {
            session.command({
              op: "insert",
              data: [-1],
              now: 0,
              date: 0,
              automatic: null,
              isCompositionEnding: null,
              correctShiftUsed: null,
            });
          } catch (error) {
            if (!(error instanceof EngineFailure)) throw error;
            invalidCode = error.code;
          }
          const unchanged = log === JSON.stringify(session.log());
          content.dispose();
          let disposedCode: string | undefined;
          try {
            content.request();
          } catch (error) {
            if (!(error instanceof EngineFailure)) throw error;
            disposedCode = error.code;
          }
          return {
            message: failure.message,
            recovery: failure.recovery,
            code: failure.code,
            recovered,
            invalidCode,
            unchanged,
            disposedCode,
          };
        } finally {
          session?.dispose();
          content.dispose();
        }
      });
      setResult(JSON.stringify(results));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
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
    setResult("");
    setFailure("");
    try {
      const input = JSON.parse(fixture()) as {
        prepare: Prepare;
        initialReplies: Source[];
        steps: (
          | { command: Command }
          | { source: Source; now: number; date: number }
        )[];
      };
      const { loadEngine } =
        await import("@caret/typing-engine/browser.client");
      const engine = await loadEngine();
      if (disposed) return;
      const content = engine.createContent();
      let session: BrowserSession | undefined;
      try {
        content.prepare(input.prepare);
        const requests: ContentRequest[] = [];
        for (let reply = 0; reply <= input.initialReplies.length; reply++) {
          try {
            session = content.createSession();
            break;
          } catch (error) {
            const request = content.request();
            const source = input.initialReplies[reply];
            if (request === null || source === undefined) throw error;
            requests.push(request);
            content.supply(request, source);
          }
        }
        if (session === undefined) {
          throw new Error("Prepared session unavailable");
        }
        handles.add(session);
        const updates: Update[] = [];
        for (const step of input.steps) {
          if ("command" in step) {
            updates.push(session.command(step.command));
          } else {
            const request = updates.at(-1)?.contentRequest;
            if (request === undefined) {
              throw new Error("Missing active content request");
            }
            updates.push(
              session.command({
                op: "supplyContent",
                request,
                source: step.source,
                now: step.now,
                date: step.date,
              }),
            );
          }
        }
        setResult(
          JSON.stringify({
            requests,
            updates,
            snapshot: session.snapshot(),
            log: session.log(),
          }),
        );
      } finally {
        if (session !== undefined) {
          session.dispose();
          handles.delete(session);
        }
        content.dispose();
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <Show
      when={import.meta.env.OXYTYPE_ENGINE_PROOF}
      fallback={<p>Unavailable</p>}
    >
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
    </Show>
  );
}
