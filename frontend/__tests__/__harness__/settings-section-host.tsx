import { render } from "@solidjs/testing-library";
import { createSignal, type JSXElement } from "solid-js";

import {
  type SettingsSection,
  SettingsSectionHostContext,
} from "../../src/ts/states/settings-sections";

/** Stand-in for the settings route's search: a signal-backed section host. */
export function createSectionHost(): {
  section: () => SettingsSection;
  setSection: (section: SettingsSection) => void;
  render: (ui: () => JSXElement) => ReturnType<typeof render>;
} {
  const [section, setSection] = createSignal<SettingsSection>("behavior");
  const Host = (props: { children: JSXElement }): JSXElement => (
    <SettingsSectionHostContext.Provider
      value={{ current: section, select: setSection }}
    >
      {props.children}
    </SettingsSectionHostContext.Provider>
  );
  return {
    section,
    setSection,
    render: (ui) => render(ui, { wrapper: Host }),
  };
}
