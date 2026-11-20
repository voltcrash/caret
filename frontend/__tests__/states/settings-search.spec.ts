import { createRoot } from "solid-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  getSearchMatchCounts,
  registerSearchable,
  settingMatchesSearch,
  setSettingsSearch,
} from "../../src/features/settings/search-state";
import { createSettingSearchIndex } from "../../src/ts/utils/settings-search";
import { SettingsSection } from "../../src/features/settings/sections-state";

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  setSettingsSearch("");
});

function register(
  settings: (Parameters<typeof createSettingSearchIndex>[0] & {
    section?: SettingsSection;
  })[] = [
    { title: "smooth caret", section: "caret" },
    { title: "caret style", section: "caret" },
    { title: "tape margin caret", section: "appearance" },
    { title: "sound volume", section: "sound" },
    { title: "caret without section" },
  ],
): ReturnType<typeof createSettingSearchIndex>[] {
  const indices = settings.map(createSettingSearchIndex);
  createRoot((d) => {
    dispose = d;
    indices.forEach((index, i) => {
      registerSearchable(() => index, settings[i]?.section);
    });
  });
  return indices;
}

describe("getSearchMatchCounts", () => {
  it("is empty without a search", () => {
    register();
    expect(getSearchMatchCounts()).toEqual({});
  });

  it("counts matching settings per section", () => {
    register();
    setSettingsSearch("caret");
    expect(getSearchMatchCounts()).toEqual({ caret: 2, appearance: 1 });
  });

  it("drops settings once unregistered", () => {
    register();
    dispose?.();
    dispose = undefined;
    setSettingsSearch("caret");
    expect(getSearchMatchCounts()).toEqual({});
  });

  it("uses named controls before passing mentions in other sections", () => {
    const indices = register([
      { title: "font size", section: "appearance" },
      { title: "font family", section: "appearance" },
      { title: "theme", description: "changes font colors", section: "theme" },
    ]);
    setSettingsSearch("font");
    expect(getSearchMatchCounts()).toEqual({ appearance: 2 });
    expect(indices.map(settingMatchesSearch)).toEqual([true, true, false]);
  });

  it("falls back to descriptions and option labels when needed", () => {
    register([
      {
        title: "difficulty",
        description: "expert ends on a mistake",
        section: "behavior",
      },
      { title: "caret style", keywords: "block underline", section: "caret" },
    ]);
    setSettingsSearch("mistake");
    expect(getSearchMatchCounts()).toEqual({ behavior: 1 });
    setSettingsSearch("underline");
    expect(getSearchMatchCounts()).toEqual({ caret: 1 });
  });

  it("counts aliases and corrected multiword queries consistently", () => {
    register();
    setSettingsSearch("cursor");
    expect(getSearchMatchCounts()).toEqual({ caret: 2, appearance: 1 });
    setSettingsSearch("smoth cursor");
    expect(getSearchMatchCounts()).toEqual({ caret: 1 });
  });

  it("rejects incomplete queries and punctuation-only queries", () => {
    const indices = register();
    for (const query of ["caret nonsense", "???"]) {
      setSettingsSearch(query);
      expect(getSearchMatchCounts()).toEqual({});
      expect(indices.some(settingMatchesSearch)).toBe(false);
    }
    setSettingsSearch("   ");
    expect(indices.every(settingMatchesSearch)).toBe(true);
  });
});
