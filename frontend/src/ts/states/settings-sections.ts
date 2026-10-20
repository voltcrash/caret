import { createContext } from "solid-js";
import {
  availableSettingsSections,
  type SettingsSection,
  settingsSections,
  SettingsUrlParamsSchema,
} from "../../features/settings/tabs";
import { isAuthenticated } from "./core";

export type { SettingsSection };
export { settingsSections, SettingsUrlParamsSchema };

export function getAvailableSettingsSections(
  authenticated = isAuthenticated(),
): Partial<typeof settingsSections> {
  return availableSettingsSections(authenticated);
}

/** The settings route's search owns the selected section. */
export type SettingsSectionHost = {
  current: () => SettingsSection;
  select: (section: SettingsSection) => void;
};
/** Outside the settings route (isolated component tests) nothing is selectable. */
export const SettingsSectionHostContext = createContext<SettingsSectionHost>({
  current: (): SettingsSection => "behavior",
  select: () => undefined,
});
