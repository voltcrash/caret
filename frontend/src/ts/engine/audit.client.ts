import { createSignal, onCleanup, untrack } from "solid-js";
import { createAppOwned } from "../../app/application";
import type { Audit } from "@caret/typing-engine/audit";

/**
 * Result audit module (timing statistics, challenge rules) for one app. Loaded
 * on first use, separately from the typing engine, so tests never wait on it.
 */
export const getBrowserAudit = createAppOwned(() => {
  const controller = new AbortController();
  type State =
    | { phase: "idle" }
    | { phase: "disposed"; error: DOMException }
    | { phase: "loading"; task: Promise<Audit> }
    | { phase: "ready"; audit: Audit; task: Promise<Audit> };
  const [state, setState] = createSignal<State>({ phase: "idle" });
  const current = (): Audit | undefined => {
    const value = state();
    return value.phase === "ready" ? value.audit : undefined;
  };
  onCleanup(() => {
    const error = new DOMException("Application disposed", "AbortError");
    setState({ phase: "disposed", error });
    controller.abort(error);
  });
  // oxlint-disable-next-line typescript/promise-function-async -- Share the exact in-flight initialization promise.
  const load = (): Promise<Audit> => {
    const value = untrack(state);
    if (value.phase === "disposed") return Promise.reject(value.error);
    if (value.phase !== "idle") return value.task;
    const task = import("@caret/typing-engine/audit.client")
      .then(async ({ loadAudit }) => loadAudit(controller.signal))
      .then((audit) => {
        controller.signal.throwIfAborted();
        setState({ phase: "ready", task, audit });
        return audit;
      })
      .catch((error: unknown) => {
        // allow a retry after a failed download
        if (!controller.signal.aborted) setState({ phase: "idle" });
        throw error;
      });
    setState({ phase: "loading", task });
    return task;
  };
  return { load, current };
});

/** The loaded audit, for views rendered only after `load()` resolved. */
export function requireBrowserAudit(): Audit {
  const audit = getBrowserAudit().current();
  if (audit === undefined) throw new Error("Typing audit is not loaded");
  return audit;
}
