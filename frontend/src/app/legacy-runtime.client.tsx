import { createEffect, onCleanup, onMount } from "solid-js";
import { type JSXElement } from "solid-js";

import { buildEventLog } from "../features/typing/runtime/events/data";
import * as Focus from "../features/typing/runtime/focus";
import * as TestTimer from "../features/typing/runtime/test-timer";
import { onAuthStateChanged } from "../ts/auth";
import { init, observeAuthSession } from "../ts/auth-client";
import { getMutableConfig } from "../ts/config/store";
import { useUrlEvents } from "../ts/controllers/url-handler";
import * as DB from "../ts/db";
import { usePsaEvents } from "../ts/elements/psa";
import * as Sentry from "../ts/sentry";
import { useConnectionEvents } from "../ts/states/connection";
import { enable } from "../ts/states/glarses-mode";
import { getLastEventLog } from "../ts/states/test";
import * as Logger from "../ts/utils/logger";
import { addToGlobal } from "../ts/utils/misc";
import BrowserRuntime from "./platform-runtime.client";
import { authReadiness } from "./readiness";
import { TypingRuntime } from "./typing-runtime.client";

/** Rollback-only page/account wiring. Retires with Stages 3–5. */
export function LegacyRuntime(): JSXElement {
  createEffect(() => {
    if (authReadiness().state().status === "ready") {
      onCleanup(observeAuthSession());
    }
  });
  useConnectionEvents();
  usePsaEvents();
  useUrlEvents();
  onMount(() => {
    Focus.set(true, true);
    void init(onAuthStateChanged).catch((error: unknown) =>
      console.error(error),
    );
    onCleanup(
      addToGlobal({
        snapshot: DB.getSnapshot,
        config: getMutableConfig(),
        glarsesMode: enable,
        enableTimerDebug: TestTimer.enableTimerDebug,
        toggleSmoothedBurst: async () => {
          const Result = await import("../features/typing/runtime/result");
          Result.toggleSmoothedBurst();
        },
        toggleDebugLogs: Logger.toggleDebugLogs,
        toggleSentryDebug: Sentry.toggleDebug,
        lastEventLog: getLastEventLog,
        currentEventLog: buildEventLog,
      }),
    );
  });
  return (
    <>
      <TypingRuntime />
      <BrowserRuntime />
    </>
  );
}
