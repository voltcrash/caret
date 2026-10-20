import {
  createEffect,
  createSignal,
  type JSXElement,
  on,
  onCleanup,
  Show,
} from "solid-js";

import { SettingsContent } from "../../ts/components/pages/settings/SettingsContent";
import { getConfig } from "../../ts/config/store";
import { highlightSetting } from "../../ts/states/settings-highlight";
import {
  type SettingsSection,
  SettingsSectionHostContext,
} from "../../ts/states/settings-sections";
import { cn } from "../../ts/utils/cn";
import { useSessionSettled } from "../auth/settled.client";
import { SettingsLoading } from "./loading";

/** Preference UI; route search owns the section and each highlight request. */
export function SettingsView(props: {
  section: SettingsSection;
  authenticated: boolean;
  highlight: string | undefined;
  onSection: (section: SettingsSection) => void;
}): JSXElement {
  const settled = useSessionSettled();
  // Filtering hides and shows groups; that must not replay the entrance.
  const [entering, setEntering] = createSignal(true);
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
    <Show
      when={settled()}
      fallback={
        <SettingsLoading
          section={props.section}
          authenticated={props.authenticated}
          keyTips={getConfig.showKeyTips}
        />
      }
    >
      <SettingsSectionHostContext.Provider
        value={{
          current: () => props.section,
          select: (section) => {
            if (section !== props.section) props.onSection(section);
          },
        }}
      >
        {/* The sidebar and settings replace their placeholders together. */}
        <div
          class={cn(
            entering() &&
              "motion-safe:[&_[data-settings-group]]:animate-[fadeIn_120ms_ease-out] motion-safe:[&_nav]:animate-[fadeIn_120ms_ease-out]",
          )}
          onAnimationEnd={() => setEntering(false)}
        >
          <SettingsContent />
        </div>
      </SettingsSectionHostContext.Provider>
    </Show>
  );
}
