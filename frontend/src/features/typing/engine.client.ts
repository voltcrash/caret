import { createSignal, onCleanup } from "solid-js";
import { createAppOwned } from "../../app/application";
import { EngineFailure } from "@oxytype/typing-engine/failure";
import type {
  BrowserContent,
  BrowserSession,
  Engine,
} from "@oxytype/typing-engine/browser.client";

type Loader = ReturnType<
  typeof import("@oxytype/typing-engine/browser.client").createEngineLoader
>;
type EngineStatus =
  | { state: "idle" | "loading" | "ready" | "disposed" }
  | { state: "failed"; error: unknown };

/** One browser engine/content owner per app; every test has a separate session. */
export const getBrowserEngine = createAppOwned(() => {
  const [status, setStatus] = createSignal<EngineStatus>({ state: "idle" });
  let loader: Loader | undefined;
  let engine: Engine | undefined;
  let content: BrowserContent | undefined;
  let session: BrowserSession | undefined;
  let pending: Promise<Engine> | undefined;
  let generation = 0;
  let sessionAbort = new AbortController();
  let disposed = false;
  const assertLive = (): void => {
    if (disposed) {
      throw new EngineFailure({
        code: "disposed",
        message: "Browser engine owner disposed",
        recovery: [],
      });
    }
  };
  // oxlint-disable-next-line typescript/promise-function-async -- Share the exact in-flight initialization promise.
  const load = (): Promise<Engine> => {
    if (disposed) {
      return Promise.reject(
        new EngineFailure({
          code: "disposed",
          message: "Browser engine owner disposed",
          recovery: [],
        }),
      );
    }
    if (engine !== undefined) return Promise.resolve(engine);
    if (pending !== undefined) return pending;
    setStatus({ state: "loading" });
    pending = import("@oxytype/typing-engine/browser.client")
      .then(async (module) => {
        assertLive();
        loader ??= module.createEngineLoader();
        return loader.load();
      })
      .then((loaded) => {
        assertLive();
        engine = loaded;
        setStatus({ state: "ready" });
        return loaded;
      })
      .catch((error: unknown) => {
        pending = undefined;
        if (!disposed) setStatus({ state: "failed", error });
        throw error;
      });
    return pending;
  };
  const preparedContent = (): BrowserContent => {
    assertLive();
    if (engine === undefined) throw new Error("Typing engine is not ready");
    return (content ??= engine.createContent());
  };
  const invalidateSession = (): void => {
    sessionAbort.abort();
    if (!disposed) sessionAbort = new AbortController();
    generation++;
  };
  const releaseSession = (retainLearning = true): void => {
    invalidateSession();
    const previous = session;
    session = undefined;
    if (previous === undefined) return;
    if (retainLearning && content !== undefined) {
      content.recycleSession(previous);
    } else {
      previous.dispose();
    }
  };
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    releaseSession(false);
    content?.dispose();
    content = undefined;
    engine = undefined;
    loader?.dispose();
    loader = undefined;
    pending = undefined;
    setStatus({ state: "disposed" });
  };
  onCleanup(dispose);
  return {
    api: (): Engine => {
      assertLive();
      if (engine === undefined) throw new Error("Typing engine is not ready");
      return engine;
    },
    status,
    load,
    dispose,
    generation: () => generation,
    captureSession: () => {
      assertLive();
      const captured = generation;
      return {
        signal: sessionAbort.signal,
        isCurrent: () => !disposed && captured === generation,
      };
    },
    session: () => {
      assertLive();
      return session;
    },
    /** Recycle before preparing new assets; generation invalidates host continuations. */
    beginReplacement: (): BrowserContent => {
      assertLive();
      releaseSession();
      return preparedContent();
    },
    /** Content preparation and any required source replies must finish first. */
    createPreparedSession: (repeating = false): BrowserSession => {
      assertLive();
      if (session !== undefined) {
        throw new Error("Release the prior session before replacement");
      }
      session = preparedContent().createSession(repeating);
      return session;
    },
    content: preparedContent,
    releaseSession,
    invalidateSession,
  };
});
