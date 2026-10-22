import type {
  BrowserSession,
  Command,
  Config,
  Text,
  Prepare,
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
  onCleanup(() => {
    disposed = true;
    for (const handle of handles) handle.dispose();
    handles.clear();
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
