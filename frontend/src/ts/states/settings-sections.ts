import { createAppSignal } from "../../app/state";

import { createContext } from "solid-js";
import { serialize as serializeUrlSearchParams } from "zod-urlsearchparams";
import {
  type SettingsSection,
  sectionForTab,
  type SettingsUrlParams,
  SettingsUrlParamsSchema,
} from "../../features/settings/tabs";
import { createEffectOn } from "../hooks/effects";
import { replaceUrl } from "../navigation/navigation";
import { FaSolidIcon } from "../types/font-awesome";
import { getActivePage, isAuthenticated } from "./core";

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

export const [getCurrentSettingsSection, setCurrentSettingsSection] =
  createAppSignal<SettingsSection>("behavior");

export function getAvailableSettingsSections(): Partial<
  typeof settingsSections
> {
  return Object.fromEntries(
    Object.entries(settingsSections).filter(
      ([, section]) => !section.requiresAuthentication || isAuthenticated(),
    ),
  );
}

function isSectionAvailable(section: SettingsSection): boolean {
  return !settingsSections[section].requiresAuthentication || isAuthenticated();
}

export function readSettingsGetParameters(
  params: SettingsUrlParams | undefined,
): void {
  const section = sectionForTab(params?.tab, isAuthenticated());
  if (section !== undefined) setCurrentSettingsSection(section);
}

/** Who owns the selected section: route search in Start, app state in rollback. */
export type SettingsSectionHost = {
  current: () => SettingsSection;
  select: (section: SettingsSection) => void;
};
export const SettingsSectionHostContext = createContext<SettingsSectionHost>({
  current: getCurrentSettingsSection,
  select: setCurrentSettingsSection,
});

export function useSettingsSectionEffects(): void {
  createEffectOn(isAuthenticated, () => {
    if (!isSectionAvailable(getCurrentSettingsSection())) {
      setCurrentSettingsSection("behavior");
    }
  });

  createEffectOn(getCurrentSettingsSection, (tab) => {
    //only replace the url while on the settings page, otherwise the url-handler breaks
    if (getActivePage() !== "settings") return;
    const urlParams = serializeUrlSearchParams({
      schema: SettingsUrlParamsSchema,
      data: { tab },
    });
    void replaceUrl(`${window.location.pathname}?${urlParams.toString()}`);
  });
}
