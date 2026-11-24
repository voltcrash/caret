import type { BrowserSession } from "@caret/typing-engine/browser.client";

import { createSignal, For, onCleanup } from "solid-js";

import {
  runContextProof,
  runRecoveryProof,
  runRestartsProof,
  runSourceFailuresProof,
} from "./engine-proof/content-runners";
import {
  runGenerationProof,
  runLiveGenerationProof,
  runQuoteCatalogProof,
  runQuoteQueueProof,
} from "./engine-proof/generation-runners";
import {
  runAnalysisProof,
  runPoliciesProof,
  runSettingPoliciesProof,
} from "./engine-proof/policy-analysis-runners";
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

  const isDisposed = (): boolean => disposed;

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

  const runWithFixture = async (
    runner: (
      rawFixture: string,
      checkDisposed: () => boolean,
    ) => Promise<string | undefined>,
    guardFailureOnDispose = false,
  ): Promise<void> => {
    const rawFixture = fixture();
    await executeProof(
      async () => runner(rawFixture, isDisposed),
      guardFailureOnDispose,
    );
  };

  const actions: { label: string; run: () => Promise<void> }[] = [
    {
      label: "Run fixture",
      run: async () => {
        const rawFixture = fixture();
        await executeProof(async () =>
          runFixtureProof({
            fixture: rawFixture,
            isDisposed,
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
      },
    },
    {
      label: "Run quote queue",
      run: async () => runWithFixture(runQuoteQueueProof),
    },
    {
      label: "Run quote catalog",
      run: async () => runWithFixture(runQuoteCatalogProof),
    },
    {
      label: "Run setting policies",
      run: async () => runWithFixture(runSettingPoliciesProof),
    },
    {
      label: "Run live generation",
      run: async () => runWithFixture(runLiveGenerationProof),
    },
    {
      label: "Run generation",
      run: async () => runWithFixture(runGenerationProof),
    },
    {
      label: "Run analysis",
      run: async () => runWithFixture(runAnalysisProof),
    },
    {
      label: "Run prepared session",
      run: async () => {
        const rawFixture = fixture();
        await executeProof(async () =>
          runPreparedProof(rawFixture, isDisposed, handles),
        );
      },
    },
    {
      label: "Run loading",
      run: async () =>
        executeProof(async () => runLoadingProof(isDisposed, loaders)),
    },
    {
      label: "Run context",
      run: async () => runWithFixture(runContextProof),
    },
    {
      label: "Run restarts",
      run: async () => runWithFixture(runRestartsProof),
    },
    {
      label: "Run policies",
      run: async () => runWithFixture(runPoliciesProof),
    },
    {
      label: "Run initialization",
      run: async () =>
        executeProof(async () => runInitializationProof(isDisposed), true),
    },
    {
      label: "Run lifecycle",
      run: async () => runWithFixture(runLifecycleProof, true),
    },
    {
      label: "Run source failures",
      run: async () => runWithFixture(runSourceFailuresProof),
    },
    {
      label: "Run recovery",
      run: async () => runWithFixture(runRecoveryProof),
    },
  ];

  return (
    <main class="p-4">
      <textarea
        aria-label="Command fixture"
        value={fixture()}
        onInput={(event) => setFixture(event.currentTarget.value)}
      ></textarea>
      <For each={actions}>
        {(action) => (
          <button
            type="button"
            onClick={() => {
              void action.run();
            }}
          >
            {action.label}
          </button>
        )}
      </For>
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
