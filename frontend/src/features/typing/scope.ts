import {
  createRoot,
  createSignal,
  getOwner,
  onCleanup,
  runWithOwner,
  untrack,
  type Owner,
} from "solid-js";

import { createAppOwned } from "../../app/application";
import { createOwnedScope, type OwnedScope } from "../../app/scope";

type RouteScope = { owner: Owner; values: OwnedScope; dispose: () => void };
const state = createAppOwned(() => {
  // Reactive so derived state (hotkeys, palette behavior) follows mounts.
  const [route, setRoute] = createSignal<RouteScope>();
  const [active, setActive] = createSignal<() => boolean>();
  return {
    route,
    setRoute,
    active,
    setActive,
    generation: 0,
    managed: false,
  };
});

/** Rollback supplies its route observation; Start owns a real mounted scope. */
export function bindTypingActivity(active: () => boolean): () => void {
  const current = state();
  current.setActive(() => active);
  return () => {
    if (untrack(current.active) === active) current.setActive(undefined);
  };
}

export function isTypingRouteActive(): boolean {
  const current = state();
  // Track the mount even before Start first manages it.
  const mounted = current.route() !== undefined;
  return current.managed ? mounted : (current.active()?.() ?? true);
}

/** Mount before constructing children; invalidate continuations before releasing refs. */
export function mountTypingScope(): () => void {
  const current = state();
  if (current.route() !== undefined) {
    throw new Error("Typing route already mounted");
  }
  const route = createRoot((dispose) => ({
    owner: getOwner() as Owner,
    values: createOwnedScope(),
    dispose,
  }));
  current.managed = true;
  current.setRoute(route);
  current.generation++;
  return () => {
    if (current.route() !== route) return;
    current.setRoute(undefined);
    current.generation++;
    route.dispose();
    route.values.dispose();
  };
}

export function captureTypingRoute(): { isCurrent: () => boolean } {
  const current = state();
  const generation = current.generation;
  return {
    isCurrent: () => current.generation === generation && isTypingRouteActive(),
  };
}

/** Browser resources end with the typing leaf; serializable session stays app-owned. */
export function createTypingOwned<T>(create: () => T): () => T {
  const key = {};
  const rollback = createAppOwned(create);
  return () => {
    const route = untrack(state().route);
    if (route === undefined) return rollback();
    return route.values.use(
      key,
      () => runWithOwner(route.owner, create) as T,
      () => undefined,
    );
  };
}

export function useTypingScope(): void {
  onCleanup(mountTypingScope());
}
