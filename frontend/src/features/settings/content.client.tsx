import { type JSXElement, onMount, Show } from "solid-js";

import { SettingsContent } from "../../ts/components/pages/settings/SettingsContent";
import { highlightSetting } from "../../ts/states/settings-highlight";
import {
  type SettingsSection,
  SettingsSectionHostContext,
} from "../../ts/states/settings-sections";
import { useSessionSettled } from "../auth/settled.client";

/**
 * Preference UI (browser-owned config). The route owns the section; a
 * `highlight` deep link is applied once on entry, like the old page show.
 */
function Mounted(props: { onMount: () => void }): null {
  onMount(() => props.onMount());
  return null;
}

export function SettingsView(props: {
  section: SettingsSection;
  highlight: string | undefined;
  onSection: (section: SettingsSection) => void;
}): JSXElement {
  let highlighted = false;
  const highlight = (): void => {
    const key = props.highlight;
    if (highlighted || key === undefined) return;
    highlighted = true;
    requestAnimationFrame(() => highlightSetting(key));
  };
  const settled = useSessionSettled();
  return (
    <Show when={settled()}>
      <SettingsSectionHostContext.Provider
        value={{
          current: () => props.section,
          select: (section) => props.onSection(section),
        }}
      >
        <SettingsContent />
        <Mounted onMount={highlight} />
      </SettingsSectionHostContext.Provider>
    </Show>
  );
}
