import { createAppOwned } from "../../app/application";
import { createAppSignal } from "../../app/state";

export const [getHighlightedSetting, setHighlightedSetting] = createAppSignal<
  string | null
>(null);
const getSettings = createAppOwned(() => ({
  callbacks: new Map<string, () => void>(),
  pending: null as string | null,
}));
export function registerSettingHighlight(
  key: string,
  highlight: () => void,
): () => void {
  const settings = getSettings();
  settings.callbacks.set(key, highlight);
  // Account controls and conditional settings can mount after a deep link.
  if (settings.pending === key) {
    settings.pending = null;
    highlight();
  }
  return () => {
    if (settings.callbacks.get(key) === highlight) {
      settings.callbacks.delete(key);
    }
  };
}
export function highlightSetting(key: string | null): void {
  setHighlightedSetting(null);
  const settings = getSettings();
  const highlight = key === null ? undefined : settings.callbacks.get(key);
  settings.pending = highlight === undefined ? key : null;
  highlight?.();
}
