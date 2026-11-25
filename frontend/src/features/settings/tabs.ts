import { z } from "zod";

import type { FaSolidIcon } from "../../ts/types/font-awesome";
import type { SettingsSection } from "./search";

export { sectionForTab, type SettingsSection } from "./search";

const SettingsSectionSchema = z.enum([
  "behavior",
  "input",
  "sound",
  "caret",
  "appearance",
  "theme",
  "hideElements",
  "account",
  "dangerZone",
]);

/** Sidebar labels; server-safe so loading layouts can show them too. */
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

/** Sections shown in the sidebar for a signed-in or anonymous actor. */
export function availableSettingsSections(
  authenticated: boolean,
): Partial<typeof settingsSections> {
  return Object.fromEntries(
    Object.entries(settingsSections).filter(
      ([, section]) => !section.requiresAuthentication || authenticated,
    ),
  );
}

/** `/settings` URL contract, including former account-settings tab names. */
export const SettingsUrlParamsSchema = z
  .object({
    tab: z.enum([
      ...SettingsSectionSchema.options,
      "authentication",
      "blockedUsers",
    ]),
    highlight: z.string(),
  })
  .partial();
