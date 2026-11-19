import { createContext } from "solid-js";

import { SettingsSection } from "../../../ts/states/settings-sections";

// the settings page section a setting is rendered in
export const SettingsSectionContext = createContext<SettingsSection>();
