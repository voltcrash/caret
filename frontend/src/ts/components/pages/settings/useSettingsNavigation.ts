import { createEffect, on } from "solid-js";

import { useRef } from "../../../hooks/useRef";
import { setSettingsSearch } from "../../../states/settings-search";
import {
  SettingsSection,
  SettingsSectionHost,
} from "../../../states/settings-sections";

/** Keep section jumps scoped to the mounted settings content. */
export function useSettingsNavigation(host: SettingsSectionHost): {
  ref: (element: HTMLDivElement) => void;
  select: (section: SettingsSection) => void;
  restore: () => void;
} {
  const [ref, content] = useRef<HTMLDivElement>();
  const scrollTo = (section: SettingsSection): void => {
    content()
      ?.querySelector<HTMLElement>(`#group_${section}`)
      ?.scrollIntoView({ block: "start", behavior: "instant" });
  };

  createEffect(on(host.current, scrollTo, { defer: true }));

  return {
    ref,
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
