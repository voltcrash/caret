import { createContext } from "solid-js";

import { SettingsSection } from "../sections-state";

// the settings page section a setting is rendered in
export const SettingsSectionContext = createContext<SettingsSection>();
