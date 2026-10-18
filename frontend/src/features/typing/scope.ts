import {
  createRoot,
  createSignal,
  getOwner,
  runWithOwner,
  untrack,
  type Owner,
} from "solid-js";

import {
  createAppOwned,
  currentApplication,
  requireApplication,
} from "../../app/application";
import { createOwnedScope, type OwnedScope } from "../../app/scope";

type RouteScope = {
  owner: Owner;
  values: OwnedScope;
  dispose: () => void;
  entered: () => boolean;
  enter: () => void;
};
const state = createAppOwned(() => {
  // Reactive so derived state (hotkeys, palette behavior) follows mounts.
  const [route, setRoute] = createSignal<RouteScope>();
  const [active, setActive] = createSignal<() => boolean>();
  return { route, setRoute, active, setActive, generation: 0, managed: false };
});

/**
 * Isolated typing-module tests run without a mounted leaf and bind activity
 * directly; once a leaf mounts, only its entry counts.
 */
export function bindTypingActivity(active: () => boolean): () => void {
  const current = state();
  current.setActive(() => active);
  return () => {
    if (untrack(current.active) !== active) return;
    current.setActive(undefined);
  };
}

/**
 * The mounted leaf becomes the active route at entry, after preferences.
 * Config loading before then never restarts.
 */
export function isTypingRouteActive(): boolean {
  const current = state();
  // Track the mount even before Start first manages it.
  const entered = current.route()?.entered() ?? false;
  return current.managed ? entered : (current.active()?.() ?? true);
}

/** Mount before constructing children; invalidate continuations before releasing refs. */
export function mountTypingScope(): () => void {
  const current = state();
  if (current.route() !== undefined) {
    throw new Error("Typing route already mounted");
  }
  const route = createRoot((dispose): RouteScope => {
    const [entered, setEntered] = createSignal(false);
    return {
      owner: getOwner() as Owner,
      values: createOwnedScope(),
      dispose,
      entered,
      enter: () => setEntered(true),
    };
  });
  current.managed = true;
  current.generation++;
  current.setRoute(route);
  return () => {
    if (current.route() !== route) return;
    current.generation++;
    current.setRoute(undefined);
    route.dispose();
    route.values.dispose();
  };
}

/** Entry lease for the current mount; activation fails after remount or disposal. */
export function captureTypingMount(): {
  activate: () => boolean;
  isCurrent: () => boolean;
} {
  const current = state();
  const route = untrack(current.route);
  const application = requireApplication();
  const isCurrent = (): boolean =>
    currentApplication() === application &&
    (!current.managed ||
      (route !== undefined && untrack(current.route) === route));
  return {
    isCurrent,
    activate: () => {
      if (currentApplication() !== application) return false;
      if (!current.managed) return isTypingRouteActive();
      if (route === undefined || untrack(current.route) !== route) return false;
      route.enter();
      return true;
    },
  };
}

export function captureTypingRoute(): { isCurrent: () => boolean } {
  const current = state();
  const generation = current.generation;
  const application = requireApplication();
  return {
    isCurrent: () =>
      currentApplication() === application &&
      current.generation === generation &&
      isTypingRouteActive(),
  };
}

/** Browser resources end with the typing leaf; serializable session stays app-owned. */
export function createTypingOwned<T>(create: () => T): () => T {
  const key = {};
  const unmounted = createAppOwned(create);
  return () => {
    const route = untrack(state().route);
    if (route === undefined) return unmounted();
    return route.values.use(
      key,
      () => runWithOwner(route.owner, create) as T,
      () => undefined,
    );
  };
}
