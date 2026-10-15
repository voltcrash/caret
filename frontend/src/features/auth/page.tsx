import type { SessionState } from "@oxytype/schemas/auth-session";

import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { lazy, Suspense } from "solid-js";
const Panel = lazy(
  createClientOnlyFn(async () => ({
    default: (await import("./panel.client")).AuthPanel,
  })),
);
export function AuthPage(props: { session: SessionState; redirect?: string }) {
  return (
    <div class="grid gap-4">
      <h1 class="text-2xl text-main">sign in</h1>
      <ClientOnly
        fallback={
          <p>
            {props.session.user === null
              ? "Sign in to your account"
              : `Signed in as ${props.session.user.displayName}`}
          </p>
        }
      >
        <Suspense fallback={<p>Loading sign in…</p>}>
          <Panel initial={props.session} redirect={props.redirect} />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
