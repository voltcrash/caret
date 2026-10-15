import { createAppOwned } from "../../app/application";
import { createAppSignal } from "../../app/state";

export const [getHighlightedSetting, setHighlightedSetting] = createAppSignal<
  string | null
>(null);
const getSettings = createAppOwned(() => new Map<string, () => void>());
export function registerSettingHighlight(
  key: string,
  highlight: () => void,
): () => void {
  const settings = getSettings();
  settings.set(key, highlight);
  return () => {
    if (settings.get(key) === highlight) settings.delete(key);
  };
}
export function highlightSetting(key: string | null): void {
  setHighlightedSetting(null);
  if (key !== null) getSettings().get(key)?.();
}
