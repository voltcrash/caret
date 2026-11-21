import { createAppMemo, createAppOwned } from "#app/application.ts";
import { createAppSignal, createAppStore } from "#app/state.ts";
import { LayoutObject } from "@caret/schemas/layouts";
import { getConfig } from "#shared/config/store.ts";
import { useResourceWithPromise } from "#shared/hooks/useResourceWithPromise.ts";
import { getLayout } from "#shared/utils/json-data.ts";
import { mirrorLayoutKeys } from "#shared/utils/key-converter.ts";
import { replaceUnderscoresWithSpaces } from "#shared/utils/strings.ts";

export const getKeymapLayout = createAppMemo<{
  layout: string;
  layoutNameDisplayString: string;
  isMirrored: boolean;
}>(() => {
  const isOverride = getConfig.keymapLayout === "overrideSync";
  const raw = isOverride ? getConfig.layout : getConfig.keymapLayout;

  const layout = raw === "default" ? "qwerty" : raw;
  const layoutNameDisplayString = replaceUnderscoresWithSpaces(raw);
  const isMirrored = getConfig.funbox.includes("layout_mirror");

  return { layout: layout, layoutNameDisplayString, isMirrored };
});

const [getKeymapHighlightKey, setKeymapHighlightKey] = createAppSignal<
  string | undefined
>(undefined);

export { getKeymapHighlightKey };

export type FlashEntry = { tick: number; correct: boolean };

const [getKeymapFlashState, setKeymapFlashState] = createAppStore<
  Record<string, FlashEntry | undefined>
>({});

export { getKeymapFlashState, setKeymapFlashState };

/** Highlights `key` (or, with a flash, clears the highlight) on the keymap. */
export function showKeymapKey(
  mode: "highlight" | "flash",
  key: string,
  correct?: boolean,
): void {
  const mappedKey = key === "" ? " " : key;
  setKeymapHighlightKey(mode === "highlight" ? mappedKey : undefined);

  if (mode === "flash" && getConfig.keymapMode === "react") {
    const existing = getKeymapFlashState[mappedKey];
    setKeymapFlashState(mappedKey, {
      tick: existing ? existing.tick + 1 : 1,
      correct: correct ?? true,
    });
  }
}

const keymapLayout = createAppOwned(() =>
  useResourceWithPromise(getKeymapLayout, async (layout) => {
    const result = await getLayout(layout.layout);
    if (layout.isMirrored) {
      return mirrorLayoutKeys(result);
    }
    return result;
  }),
);
export const keymapLayoutObject = (): LayoutObject | undefined =>
  keymapLayout()[0]();

/** Resolves once the current keymap layout has loaded. */
export async function waitForKeymapLayout(): Promise<LayoutObject> {
  await keymapLayout()[1].promise;
  const result = keymapLayoutObject();
  if (result === undefined) {
    throw new Error("Failed to load keymap layout");
  }
  return result;
}

export function flash(key: string, correct?: boolean): void {
  showKeymapKey("flash", key, correct);
}

export function highlight(key: string): void {
  showKeymapKey("highlight", key);
}
