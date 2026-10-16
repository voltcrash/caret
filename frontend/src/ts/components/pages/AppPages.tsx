import { typedKeys } from "@oxytype/util/objects";
import { animate } from "animejs";
import { createSignal, For, JSXElement, onCleanup, Show } from "solid-js";

import type { PageName } from "../../pages/page";

import { TestPage } from "../../../features/typing/components/TestPage";
import { bindTypingActivity } from "../../../features/typing/scope";
import { createEffectOn } from "../../hooks/effects";
import { getActivePage } from "../../states/core";
import {
  get as isPageTransitioning,
  getPageView,
} from "../../states/page-transition";
import { cn } from "../../utils/cn";
import { applyReducedMotion } from "../../utils/misc";
import { lazyPages } from "./lazy-pages";
import { LoadingPage } from "./LoadingPage";

export function AppPages(): JSXElement {
  onCleanup(
    bindTypingActivity(() => getActivePage() === "test", isPageTransitioning),
  );
  const refs = new Map<PageName, HTMLElement>();
  const [visited, setVisited] = createSignal(new Set<PageName>());
  createEffectOn(getPageView, ({ id }) => {
    if (id !== null && !visited().has(id)) {
      setVisited((previous) => new Set([...previous, id]));
    }
  });
  const view = (id: PageName) =>
    getPageView().id === id ? getPageView() : undefined;

  const shell = (
    id: PageName,
    children: JSXElement,
    className?: string,
  ): JSXElement => {
    return (
      <div
        ref={(el) => refs.set(id, el)}
        id={`page${id[0]?.toUpperCase()}${id.slice(1)}`}
        class={cn(
          `page page${id[0]?.toUpperCase()}${id.slice(1)}`,
          className,
          view(id)?.phase === "prepared" && "hidden",
          view(id)?.phase === "active" && "active",
        )}
      >
        {children}
      </div>
    );
  };

  const deferredPage = (
    id: keyof typeof lazyPages,
    className?: string,
  ): JSXElement => {
    const Component = lazyPages[id];
    return shell(
      id,
      <Show when={visited().has(id)}>
        <Component />
      </Show>,
      className,
    );
  };

  // Keep the component owners and cached test refs alive, like the old Skeleton.
  // Show attaches/detaches their nodes; existing Page gates own page content.
  const pages: Record<PageName, JSXElement> = {
    loading: shell(
      "loading",
      <LoadingPage />,
      "grid h-full w-full place-self-center content-center items-center",
    ),
    about: deferredPage("about", "full-width"),
    settings: deferredPage("settings"),
    account: deferredPage("account"),
    login: deferredPage("login"),
    device: deferredPage("device"),
    profile: deferredPage("profile"),
    profileSearch: deferredPage("profileSearch"),
    test: (
      <TestPage
        ref={(el) => refs.set("test", el)}
        class={cn(
          view("test")?.phase === "prepared" &&
            !view("test")?.revealed &&
            "hidden",
          view("test")?.phase === "active" && "active",
        )}
      />
    ),
    "404": deferredPage("404"),
    leaderboards: deferredPage("leaderboards"),
  };

  createEffectOn(getPageView, (state) => {
    const request = state.animation;
    if (state.id === null || request === undefined) return;
    const element = refs.get(state.id);
    if (element === undefined) throw new Error(`Missing page ref: ${state.id}`);
    const entering = state.phase === "in";
    const animation = animate(element, {
      opacity: entering ? [0, 1] : [1, 0],
      duration: applyReducedMotion(request.duration),
      onComplete: request.complete,
    });
    onCleanup(() => {
      animation.cancel();
      request.complete();
    });
  });

  return (
    <For each={typedKeys(pages)}>
      {(id) => <Show when={getPageView().id === id}>{pages[id]}</Show>}
    </For>
  );
}
