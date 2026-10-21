import {
  createEffect,
  createSignal,
  type JSXElement,
  on,
  onCleanup,
} from "solid-js";

import { SettingsContent } from "../../ts/components/pages/settings/SettingsContent";
import { highlightSetting } from "../../ts/states/settings-highlight";
import {
  type SettingsSection,
  SettingsSectionHostContext,
} from "../../ts/states/settings-sections";
import { cn } from "../../ts/utils/cn";
import { useSessionSettled } from "../auth/settled.client";

/** Preference UI; route search owns the section and each highlight request. */
export function SettingsView(props: {
  section: SettingsSection;
  authenticated: boolean;
  highlight: string | undefined;
  onSection: (section: SettingsSection) => void;
}): JSXElement {
  const settled = useSessionSettled();
  const accountReady = () => settled() && props.authenticated;
  // Filtering hides and shows groups; that must not replay the entrance.
  const [entering, setEntering] = createSignal(true);
  createEffect(
    on([() => props.highlight, accountReady], ([key]) => {
      if (key === undefined) {
        highlightSetting(null);
        return;
      }
      // Settings register their refs during mount; search-only navigation keeps
      // them mounted and can request another highlight without a page lifecycle.
      // Account controls can also push the target down when the session settles.
      const frame = requestAnimationFrame(() => highlightSetting(key));
      onCleanup(() => cancelAnimationFrame(frame));
    }),
  );
  onCleanup(() => highlightSetting(null));
  return (
    <SettingsSectionHostContext.Provider
      value={{
        current: () => props.section,
        select: (section) => {
          if (section !== props.section) props.onSection(section);
        },
      }}
    >
      <div
        class={cn(
          entering() &&
            "motion-safe:[&_[data-settings-group]]:animate-[fadeIn_120ms_ease-out] motion-safe:[&_nav]:animate-[fadeIn_120ms_ease-out]",
        )}
        onAnimationEnd={() => setEntering(false)}
      >
        <SettingsContent authenticated={accountReady()} />
      </div>
    </SettingsSectionHostContext.Provider>
  );
}
