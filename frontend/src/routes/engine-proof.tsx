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
} from "@oxytype/typing-engine/browser.client";

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
        await import("@oxytype/typing-engine/browser.client");
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
      await import("@oxytype/typing-engine/browser.client");
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
        await import("@oxytype/typing-engine/browser.client");
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
            emptyLog: (next.log() as Log).events.length === 0,
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
        await import("@oxytype/typing-engine/browser.client");
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
        await import("@oxytype/typing-engine/browser.client");
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
        await import("@oxytype/typing-engine/browser.client");
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
        log: Log;
        queries: Query[];
        playback?: { zen: boolean; targets: Cursor[] }[];
      }[];
      const { loadEngine, analyzeLog } =
        await import("@oxytype/typing-engine/browser.client");
      const engine = await loadEngine();
      if (disposed) return;
      setResult(
        JSON.stringify(
          inputs.map(({ log, queries, playback }) => {
            const analysis = queries.map((query) => analyzeLog(log, query));
            if (playback === undefined) return analysis;
            return {
              analysis,
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
        await import("@oxytype/typing-engine/browser.client");
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
