import { createModuleRoot } from "../hooks/effects";
import { createMemo, createSignal, onCleanup } from "solid-js";

import {
  scoreSettingSearch,
  SettingSearchIndex,
  tokenizeSettingsSearch,
} from "../utils/settings-search";
import { SettingsSection } from "./settings-sections";

// the current settings filter query, shared between the search input and the
// settings/sections that hide themselves when they don't match
export const [getSettingsSearch, setSettingsSearch] = createSignal("");

export const isSettingsSearchActive = (): boolean =>
  getSettingsSearch().trim() !== "";

type Searchable = {
  index: () => SettingSearchIndex;
  section?: SettingsSection;
};

// Only mounted settings participate; conditional controls register on mount.
const [getSearchables, setSearchables] = createSignal<Set<Searchable>>(
  new Set(),
  {
    equals: false,
  },
);

export function registerSearchable(
  index: () => SettingSearchIndex,
  section?: SettingsSection,
): void {
  const searchable: Searchable = { index, section };
  setSearchables((s) => s.add(searchable));
  onCleanup(() =>
    setSearchables((s) => {
      s.delete(searchable);
      return s;
    }),
  );
}

export const getSettingsSearchTokens = createModuleRoot(import.meta.hot, () =>
  createMemo(() => tokenizeSettingsSearch(getSettingsSearch())),
);

// Score once per query, sharing the same matches between rows and sidebar counts.
const getMatchingSettings = createModuleRoot(import.meta.hot, () =>
  createMemo(() => {
    const tokens = getSettingsSearchTokens();
    const scores = new Map<SettingSearchIndex, number>();
    let best = 0;
    if (tokens.length > 0) {
      for (const { index } of getSearchables()) {
        const setting = index();
        const score = scoreSettingSearch(setting, tokens);
        scores.set(setting, score);
        best = Math.max(best, score);
      }
    }
    return new Set(
      [...scores]
        .filter(([, score]) => score > 0 && score === best)
        .map(([setting]) => setting),
    );
  }),
);

export function settingMatchesSearch(index: SettingSearchIndex): boolean {
  return !isSettingsSearchActive() || getMatchingSettings().has(index);
}

// how many settings in each section match the active search
export const getSearchMatchCounts = createModuleRoot(import.meta.hot, () =>
  createMemo(() => {
    const counts: Partial<Record<SettingsSection, number>> = {};
    if (!isSettingsSearchActive()) return counts;
    const matches = getMatchingSettings();
    for (const { index, section } of getSearchables()) {
      if (section === undefined || !matches.has(index())) continue;
      counts[section] = (counts[section] ?? 0) + 1;
    }
    return counts;
  }),
);
