import type { SessionState } from "@oxytype/schemas/auth-session";

import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { lazy, Suspense } from "solid-js";

import { Fa } from "../../ts/components/common/Fa";
const Panel = lazy(
  createClientOnlyFn(async () => ({
    default: (await import("./panel.client")).AuthPanel,
  })),
);
export function AuthPage(props: { session: SessionState; redirect?: string }) {
  return (
    <div class="flex h-full items-center justify-center py-8">
      <div class="grid w-full max-w-sm content-start gap-6">
        <h1 class="flex items-center gap-3 text-2xl text-main">
          <Fa icon="fa-sign-in-alt" />
          sign in
        </h1>
        <ClientOnly
          fallback={
            <p class="text-sub">
              {props.session.user === null
                ? "Sign in to your account"
                : `Signed in as ${props.session.user.displayName}`}
            </p>
          }
        >
          <Suspense fallback={<p class="text-sub">Loading sign in…</p>}>
            <Panel initial={props.session} redirect={props.redirect} />
          </Suspense>
        </ClientOnly>
      </div>
    </div>
  );
}
