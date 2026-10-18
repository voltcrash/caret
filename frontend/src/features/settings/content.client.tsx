import { createEffect, type JSXElement, on, onCleanup, Show } from "solid-js";

import { RestorePageScroll } from "../../components/page-scroll";
import { SettingsContent } from "../../ts/components/pages/settings/SettingsContent";
import { highlightSetting } from "../../ts/states/settings-highlight";
import {
  type SettingsSection,
  SettingsSectionHostContext,
} from "../../ts/states/settings-sections";
import { useSessionSettled } from "../auth/settled.client";

/** Preference UI; route search owns the section and each highlight request. */
export function SettingsView(props: {
  section: SettingsSection;
  highlight: string | undefined;
  onSection: (section: SettingsSection) => void;
}): JSXElement {
  const settled = useSessionSettled();
  createEffect(
    on(
      () => (settled() ? props.highlight : undefined),
      (key) => {
        if (key === undefined) return;
        // Settings register their refs during mount; search-only navigation keeps
        // them mounted and can request another highlight without a page lifecycle.
        const frame = requestAnimationFrame(() => highlightSetting(key));
        onCleanup(() => cancelAnimationFrame(frame));
      },
    ),
  );
  return (
    <Show when={settled()}>
      <SettingsSectionHostContext.Provider
        value={{
          current: () => props.section,
          select: (section) => {
            if (section !== props.section) props.onSection(section);
          },
        }}
      >
        <SettingsContent />
        <RestorePageScroll />
      </SettingsSectionHostContext.Provider>
    </Show>
  );
}
