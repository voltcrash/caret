export type SettingsSection =
  | "behavior"
  | "input"
  | "sound"
  | "caret"
  | "appearance"
  | "theme"
  | "hideElements"
  | "account"
  | "dangerZone";

type SettingsTab = SettingsSection | "authentication" | "blockedUsers";

export type SettingsUrlParams = {
  tab?: SettingsTab;
  highlight?: string;
};

const validTabs = new Set<string>([
  "behavior",
  "input",
  "sound",
  "caret",
  "appearance",
  "theme",
  "hideElements",
  "account",
  "dangerZone",
  "authentication",
  "blockedUsers",
]);

const authenticatedSections: readonly SettingsSection[] = ["account"];

function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

/** Validate `/settings` URL params without pulling zod into the eager route bundle. */
export function parseSettingsSearch(
  search: Record<string, unknown>,
): SettingsUrlParams {
  const cleared: SettingsUrlParams = { tab: undefined, highlight: undefined };
  const rawTab = search["tab"];
  const rawHighlight = search["highlight"];
  let tab: SettingsTab | undefined;
  if (rawTab !== undefined && rawTab !== null) {
    const value = asString(rawTab);
    if (value === undefined || !validTabs.has(value)) return cleared;
    tab = value as SettingsTab;
  }
  let highlight: string | undefined;
  if (rawHighlight !== undefined && rawHighlight !== null) {
    highlight = asString(rawHighlight);
    if (highlight === undefined) return cleared;
  }
  return { tab, highlight };
}

/** Section a URL tab opens; unavailable sections fall back to behavior. */
export function sectionForTab(
  tab: SettingsUrlParams["tab"],
  authenticated: boolean,
): SettingsSection | undefined {
  if (tab === undefined) return undefined;
  const section: SettingsSection =
    tab === "authentication"
      ? "account"
      : tab === "blockedUsers"
        ? "behavior"
        : tab;
  return authenticated || !authenticatedSections.includes(section)
    ? section
    : "behavior";
}
