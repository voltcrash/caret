import { createContext } from "solid-js";
import {
  type SettingsSection,
  SettingsUrlParamsSchema,
} from "../../features/settings/tabs";
import { FaSolidIcon } from "../types/font-awesome";
import { isAuthenticated } from "./core";

export type { SettingsSection };
export { SettingsUrlParamsSchema };

export const settingsSections: Record<
  SettingsSection,
  { icon: FaSolidIcon; text: string; requiresAuthentication?: boolean }
> = {
  behavior: { text: "behavior", icon: "fa-tools" },
  input: { text: "input", icon: "fa-keyboard" },
  sound: { text: "sound", icon: "fa-volume-up" },
  caret: { text: "caret", icon: "fa-i-cursor" },
  appearance: { text: "appearance", icon: "fa-palette" },
  theme: { text: "theme", icon: "fa-brush" },
  hideElements: { text: "hide elements", icon: "fa-eye-slash" },
  account: {
    text: "account",
    icon: "fa-user",
    requiresAuthentication: true,
  },
  dangerZone: { text: "advanced", icon: "fa-sliders-h" },
};

export function getAvailableSettingsSections(): Partial<
  typeof settingsSections
> {
  return Object.fromEntries(
    Object.entries(settingsSections).filter(
      ([, section]) => !section.requiresAuthentication || isAuthenticated(),
    ),
  );
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
