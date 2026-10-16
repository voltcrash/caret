import { createEffect, onCleanup, onMount } from "solid-js";
import { type JSXElement } from "solid-js";

import { TypingRuntime } from "../features/typing/runtime.client";
import * as Focus from "../features/typing/runtime/focus";
import { onAuthStateChanged } from "../ts/auth";
import { init, observeAuthSession } from "../ts/auth-client";
import { useUrlEvents } from "../ts/controllers/url-handler";
import * as DB from "../ts/db";
import { usePsaEvents } from "../ts/elements/psa";
import { addToGlobal } from "../ts/utils/misc";
import BrowserRuntime from "./platform-runtime.client";
import { authReadiness } from "./readiness";

/** Rollback-only page/account wiring. Retires with Stages 3–5. */
export function LegacyRuntime(): JSXElement {
  createEffect(() => {
    if (authReadiness().state().status === "ready") {
      onCleanup(observeAuthSession());
    }
  });
  usePsaEvents();
  useUrlEvents();
  onMount(() => {
    Focus.set(true, true);
    void init(onAuthStateChanged).catch((error: unknown) =>
      console.error(error),
    );
    onCleanup(addToGlobal({ snapshot: DB.getSnapshot }));
  });
  return (
    <>
      <TypingRuntime />
      <BrowserRuntime />
    </>
  );
}
