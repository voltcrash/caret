import { createSignal, onCleanup, untrack } from "solid-js";
import { createAppOwned } from "../../app/application";
import { EngineFailure } from "@caret/typing-engine/failure";
import type {
  BrowserContent,
  BrowserSession,
  Engine,
} from "@caret/typing-engine/browser.client";

type Loader = ReturnType<
  typeof import("@caret/typing-engine/browser.client").createEngineLoader
>;
type EngineStatus =
  | { state: "idle" | "disposed" }
  | { state: "loading"; task: Promise<Engine> }
  | { state: "ready"; engine: Engine }
  | { state: "failed"; error: unknown };

/** One browser engine/content owner per app; every test has a separate session. */
export const getBrowserEngine = createAppOwned(() => {
  const [status, setStatus] = createSignal<EngineStatus>({ state: "idle" });
  let loader: Loader | undefined;
  let content: BrowserContent | undefined;
  let session: BrowserSession | undefined;
  let generation = 0;
  let sessionAbort = new AbortController();
  const disposed = (): boolean => untrack(status).state === "disposed";
  const assertLive = (): void => {
    if (disposed()) {
      throw new EngineFailure({
        code: "disposed",
        message: "Browser engine owner disposed",
        recovery: [],
      });
    }
    const current = status();
    if (
      current.state === "failed" &&
      current.error instanceof EngineFailure &&
      current.error.code === "internal"
    ) {
      throw current.error;
    }
  };
  // oxlint-disable-next-line typescript/promise-function-async -- Share the exact in-flight initialization promise.
  const load = (): Promise<Engine> => {
    const current = status();
    if (
      current.state === "failed" &&
      current.error instanceof EngineFailure &&
      current.error.code === "internal"
    ) {
      return Promise.reject(current.error);
    }
    if (disposed()) {
      return Promise.reject(
        new EngineFailure({
          code: "disposed",
          message: "Browser engine owner disposed",
          recovery: [],
        }),
      );
    }
    if (current.state === "ready") return Promise.resolve(current.engine);
    if (current.state === "loading") return current.task;
    const task = import("@caret/typing-engine/browser.client")
      .then(async (module) => {
        assertLive();
        loader ??= module.createEngineLoader();
        return loader.load();
      })
      .then((loaded) => {
        assertLive();
        setStatus({ state: "ready", engine: loaded });
        return loaded;
      })
      .catch((error: unknown) => {
        if (!disposed()) setStatus({ state: "failed", error });
        throw error;
      });
    setStatus({ state: "loading", task });
    return task;
  };
  const api = (): Engine => {
    assertLive();
    const current = status();
    if (current.state !== "ready") {
      throw new Error("Typing engine is not ready");
    }
    return current.engine;
  };
  const preparedContent = (): BrowserContent => {
    const engine = api();
    return (content ??= engine.createContent());
  };
  const invalidateSession = (): void => {
    sessionAbort.abort();
    if (!disposed()) sessionAbort = new AbortController();
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
    if (disposed()) return;
    setStatus({ state: "disposed" });
    releaseSession(false);
    content?.dispose();
    content = undefined;
    loader?.dispose();
    loader = undefined;
  };
  onCleanup(dispose);
  return {
    api,
    status,
    fail: (error: unknown): void => {
      if (disposed()) return;
      invalidateSession();
      setStatus({ state: "failed", error });
    },
    load,
    dispose,
    generation: () => generation,
    captureSession: () => {
      assertLive();
      const captured = generation;
      return {
        signal: sessionAbort.signal,
        isCurrent: () => !disposed() && captured === generation,
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
