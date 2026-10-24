import { createSignal, onCleanup } from "solid-js";
import { createAppOwned } from "../../app/application";
import type { Audit } from "@oxytype/typing-engine/audit";

/**
 * Result audit module (timing statistics, challenge rules) for one app. Loaded
 * on first use, separately from the typing engine, so tests never wait on it.
 */
export const getBrowserAudit = createAppOwned(() => {
  const controller = new AbortController();
  const [current, setCurrent] = createSignal<Audit>();
  let pending: Promise<Audit> | undefined;
  onCleanup(() =>
    controller.abort(new DOMException("Application disposed", "AbortError")),
  );
  // oxlint-disable-next-line typescript/promise-function-async -- Share the exact in-flight initialization promise.
  const load = (): Promise<Audit> =>
    (pending ??= import("@oxytype/typing-engine/audit.client")
      .then(async ({ loadAudit }) => loadAudit(controller.signal))
      .then((audit) => {
        setCurrent(audit);
        return audit;
      })
      .catch((error: unknown) => {
        // allow a retry after a failed download
        pending = undefined;
        throw error;
      }));
  return { load, current };
});

/** The loaded audit, for views rendered only after `load()` resolved. */
export function requireBrowserAudit(): Audit {
  const audit = getBrowserAudit().current();
  if (audit === undefined) throw new Error("Typing audit is not loaded");
  return audit;
}
