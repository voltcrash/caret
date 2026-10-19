import {
  createHotkeyHint,
  formatForDisplay,
  Hotkey,
} from "@tanstack/solid-hotkeys";
import {
  createSignal,
  For,
  JSXElement,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import { useRef } from "../../hooks/useRef";
import { createHotkey } from "../../input/hotkeys/utils";
import { isAnyPopupVisible } from "../../states/overlay-visibility";
import { getHeaderBottom } from "../../states/page-layout";
import { FaSolidIcon } from "../../types/font-awesome";
import { cn } from "../../utils/cn";
import { Button } from "./Button";
import { Separator } from "./Separator";

export type SidebarItem = { text: string; icon: FaSolidIcon };

// page layout with a navigation sidebar on the left (stacked on top on mobile)
// and the active tab's content on the right
export function SidebarLayout<T extends string>(props: {
  items: Partial<Record<T, SidebarItem>>;
  // no item is shown as active when undefined
  active: T | undefined;
  onSelect: (key: T) => void;
  // Continuous pages scroll to their own section instead of the content top.
  scrollToContent?: boolean;
  // extra content above the items
  header?: JSXElement;
  // extra content below the items, split off by a separator
  footer?: JSXElement;
  // when set, shows a count next to each item and dims items without one
  counts?: Partial<Record<T, number>>;
  // mod + 1-9 selects the first nine items while true
  hotkeys?: boolean;
  children: JSXElement;
}): JSXElement {
  const [contentRef, content] = useRef<HTMLDivElement>();
  const [navRef, nav] = useRef<HTMLElement>();

  // the sidebar's height, so it can stick in the vertical middle of the screen
  const [navHeight, setNavHeight] = createSignal(0);
  onMount(() => {
    const element = nav();
    if (element === undefined) return;
    const observer = new ResizeObserver(() =>
      setNavHeight(element.offsetHeight),
    );
    observer.observe(element);
    onCleanup(() => observer.disconnect());
  });

  const select = (key: T): void => {
    props.onSelect(key);
    if (props.scrollToContent === false) return;
    // the sidebar stays in view while scrolling (or sits above the content on
    // mobile), so bring the top of the new content into view
    const top = content()?.getBoundingClientRect().top;
    if (top !== undefined && (top < 0 || top > window.innerHeight / 2)) {
      content()?.scrollIntoView({ block: "start" });
    }
  };

  const keys = (): T[] => Object.keys(props.items) as T[];
  const hotkey = (index: number): Hotkey => `Mod+${index + 1}` as Hotkey;
  for (let i = 0; i < 9; i++) {
    createHotkey(
      hotkey(i),
      () => {
        const key = keys()[i];
        if (key !== undefined && !isAnyPopupVisible()) select(key);
      },
      () => ({ enabled: props.hotkeys === true && i < keys().length }),
    );
  }

  // holding mod reveals which number selects each item
  const isModHeld = createHotkeyHint(hotkey(0));
  const showHotkeys = (): boolean =>
    props.hotkeys === true && isModHeld() && !isAnyPopupVisible();

  return (
    <div
      class="content-grid flex flex-col gap-8 md:flex-row"
      style={{ "--header-bottom": `${getHeaderBottom()}px` }}
    >
      {/* reserve the sidebar's space while its navigation stays outside the
          content's scrolling and overscroll movement on desktop */}
      <div
        class="w-full shrink-0 md:h-(--sidebar-height) md:w-60 md:self-start"
        style={{ "--sidebar-height": `${navHeight()}px` }}
      >
        {/* items are laid out in two columns on mobile to keep the sidebar short */}
        <nav
          aria-label="Page sections"
          ref={navRef}
          class="grid grid-cols-2 gap-2 rounded-double bg-sub-alt p-4 md:fixed md:top-[max(calc(var(--header-bottom)+1rem),calc(50vh-var(--sidebar-height)/2))] md:z-20 md:flex md:max-h-[calc(100vh-var(--header-bottom)-2rem)] md:w-60 md:flex-col md:items-start md:gap-4 md:overflow-y-auto md:overscroll-y-none"
        >
          <Show when={props.header !== undefined}>
            <div class="col-span-full w-full">{props.header}</div>
          </Show>
          <For each={Object.entries(props.items) as [T, SidebarItem][]}>
            {([key, item], index) => (
              <Button
                variant="text"
                fa={{ icon: item.icon, class: "shrink-0" }}
                active={props.active === key}
                class={cn(
                  "min-w-0 justify-start text-left [--themable-button-active:var(--themable-button-text)]",
                  // 44px minimum tap target on touch screens
                  "pointer-coarse:min-h-11",
                  (props.counts !== undefined || showHotkeys()) && "w-full",
                  props.counts !== undefined &&
                    (props.counts[key] ?? 0) === 0 &&
                    "opacity-50",
                )}
                onClick={() => select(key)}
              >
                <span class="min-w-0 wrap-anywhere">{item.text}</span>
                <Show
                  when={showHotkeys() && index() < 9}
                  fallback={
                    <Show when={props.counts !== undefined}>
                      <span class="ml-auto shrink-0 rounded bg-bg px-[0.5em] text-em-xs text-sub">
                        {props.counts?.[key] ?? 0}
                      </span>
                    </Show>
                  }
                >
                  <kbd class="ml-auto shrink-0">
                    {formatForDisplay(hotkey(index()))}
                  </kbd>
                </Show>
              </Button>
            )}
          </For>
          <Show when={props.footer !== undefined}>
            {/* the larger gap balances the padding below the last item's label */}
            <div class="col-span-full grid w-full gap-6">
              {/* inset to line up with the item icons */}
              <Separator class="mx-2 w-auto bg-bg" />
              <div class="grid gap-2">{props.footer}</div>
            </div>
          </Show>
        </nav>
      </div>
      <div
        ref={contentRef}
        class="flex w-full flex-1 scroll-mt-[calc(var(--header-bottom)+1rem)] flex-col gap-8"
      >
        {props.children}
      </div>
    </div>
  );
}
