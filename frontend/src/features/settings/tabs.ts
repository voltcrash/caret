import { z } from "zod";

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
export type SettingsSection = z.infer<typeof SettingsSectionSchema>;

/** `/settings` URL contract, including former account-settings tab names. */
export const SettingsUrlParamsSchema = z
  .object({
    tab: z.enum([
      ...SettingsSectionSchema.options,
      "authentication",
      "blockedUsers",
      "apeKeys",
    ]),
    highlight: z.string(),
  })
  .partial();
export type SettingsUrlParams = z.infer<typeof SettingsUrlParamsSchema>;

const authenticatedSections: readonly SettingsSection[] = ["account"];

/** Section a URL tab opens; unavailable sections fall back to behavior. */
export function sectionForTab(
  tab: SettingsUrlParams["tab"],
  authenticated: boolean,
): SettingsSection | undefined {
  if (tab === undefined) return undefined;
  const section =
    tab === "authentication"
      ? "account"
      : tab === "blockedUsers" || tab === "apeKeys"
        ? "behavior"
        : tab;
  return authenticated || !authenticatedSections.includes(section)
    ? section
    : "behavior";
}
