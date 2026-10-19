import { Accessor, createEffect, createSignal, on, onCleanup } from "solid-js";

import { useRef } from "../../../hooks/useRef";
import { getHeaderBottom, getPageScroller } from "../../../states/page-layout";
import {
  isSettingsSearchActive,
  setSettingsSearch,
} from "../../../states/settings-search";
import {
  SettingsSection,
  SettingsSectionHost,
} from "../../../states/settings-sections";

/** Keep section jumps scoped to the mounted settings content. */
export function useSettingsNavigation(host: SettingsSectionHost): {
  ref: (element: HTMLDivElement) => void;
  active: Accessor<SettingsSection>;
  select: (section: SettingsSection) => void;
  restore: () => void;
} {
  const [ref, content] = useRef<HTMLDivElement>();
  const [active, setActive] = createSignal(host.current());
  const scrollTo = (section: SettingsSection): void => {
    setActive(section);
    content()
      ?.querySelector<HTMLElement>(`#group_${section}`)
      ?.scrollIntoView({ block: "start", behavior: "instant" });
  };

  createEffect(on(host.current, scrollTo, { defer: true }));

  createEffect(() => {
    const element = content();
    if (element === undefined || isSettingsSearchActive()) return;
    const scroller = getPageScroller() ?? window;
    const headingTop = getHeaderBottom() + 32;
    let frame: number | undefined;
    const update = (): void => {
      frame = undefined;
      const sections = element.querySelectorAll<HTMLElement>(
        "[data-settings-section]",
      );
      let current = sections[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top > headingTop) break;
        current = section;
      }
      if (current !== undefined) {
        setActive(current.dataset["settingsSection"] as SettingsSection);
      }
    };
    const schedule = (): void => {
      frame ??= requestAnimationFrame(update);
    };
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Conditional controls and theme/font changes can move section headings.
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    schedule();
    onCleanup(() => {
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    });
  });

  return {
    ref,
    active,
    select: (section: SettingsSection): void => {
      setSettingsSearch("");
      // Repeated selections must jump even when the URL hasn't changed.
      scrollTo(section);
      host.select(section);
    },
    restore: (): void => {
      // On mobile, the default page starts with navigation above behavior.
      if (host.current() !== "behavior") scrollTo(host.current());
    },
  };
}
