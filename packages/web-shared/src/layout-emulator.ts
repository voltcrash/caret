import type { LayoutObject } from "@caret/schemas/layouts";
export type LayoutModifiers = {
  code: string;
  shift: boolean;
  altGr: boolean;
  capsLock: boolean;
  key?: string;
};
const casedLetter = /\p{Cased_Letter}/u;

export function getCharFromLayout(
  layout: Omit<LayoutObject, "type"> & { type: "ansi" | "iso" | "matrix" },
  event: LayoutModifiers,
): string | null {
  function emulatedLayoutGetVariant(
    modifiers: LayoutModifiers,
    keyVariants: string[],
  ): string | undefined {
    let isCapitalized = modifiers.shift;
    const altGrIndex = modifiers.altGr && keyVariants.length > 2 ? 2 : 0;
    if (
      modifiers.capsLock &&
      casedLetter.test(keyVariants[altGrIndex] ?? "") &&
      casedLetter.test(keyVariants[altGrIndex + 1] ?? "")
    ) {
      isCapitalized = !modifiers.shift;
    }

    const altVersion = keyVariants[(isCapitalized ? 1 : 0) + altGrIndex] ?? "";
    const nonAltVersion = keyVariants[isCapitalized ? 1 : 0] ?? "";
    const defaultVersion = keyVariants[0];

    return altVersion || nonAltVersion || defaultVersion;
  }

  let keyEventCodes: string[] = [];

  if (layout.type === "ansi") {
    keyEventCodes = [
      "Backquote",
      "Digit1",
      "Digit2",
      "Digit3",
      "Digit4",
      "Digit5",
      "Digit6",
      "Digit7",
      "Digit8",
      "Digit9",
      "Digit0",
      "Minus",
      "Equal",
      "KeyQ",
      "KeyW",
      "KeyE",
      "KeyR",
      "KeyT",
      "KeyY",
      "KeyU",
      "KeyI",
      "KeyO",
      "KeyP",
      "BracketLeft",
      "BracketRight",
      "Backslash",
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyF",
      "KeyG",
      "KeyH",
      "KeyJ",
      "KeyK",
      "KeyL",
      "Semicolon",
      "Quote",
      "KeyZ",
      "KeyX",
      "KeyC",
      "KeyV",
      "KeyB",
      "KeyN",
      "KeyM",
      "Comma",
      "Period",
      "Slash",
      "Space",
    ];
  } else if (layout.type === "iso") {
    keyEventCodes = [
      "Backquote",
      "Digit1",
      "Digit2",
      "Digit3",
      "Digit4",
      "Digit5",
      "Digit6",
      "Digit7",
      "Digit8",
      "Digit9",
      "Digit0",
      "Minus",
      "Equal",
      "KeyQ",
      "KeyW",
      "KeyE",
      "KeyR",
      "KeyT",
      "KeyY",
      "KeyU",
      "KeyI",
      "KeyO",
      "KeyP",
      "BracketLeft",
      "BracketRight",
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyF",
      "KeyG",
      "KeyH",
      "KeyJ",
      "KeyK",
      "KeyL",
      "Semicolon",
      "Quote",
      "Backslash",
      "IntlBackslash",
      "KeyZ",
      "KeyX",
      "KeyC",
      "KeyV",
      "KeyB",
      "KeyN",
      "KeyM",
      "Comma",
      "Period",
      "Slash",
      "Space",
    ];
  } else if (layout.type === "matrix") {
    keyEventCodes = [
      "Backquote",
      "Digit1",
      "Digit2",
      "Digit3",
      "Digit4",
      "Digit5",
      "Digit6",
      "Digit7",
      "Digit8",
      "Digit9",
      "Digit0",
      "Minus",
      "Equal",
      "KeyQ",
      "KeyW",
      "KeyE",
      "KeyR",
      "KeyT",
      "KeyY",
      "KeyU",
      "KeyI",
      "KeyO",
      "KeyP",
      "BracketLeft",
      "BracketRight",
      "Backslash",
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyF",
      "KeyG",
      "KeyH",
      "KeyJ",
      "KeyK",
      "KeyL",
      "Semicolon",
      "Quote",
      "KeyZ",
      "KeyX",
      "KeyC",
      "KeyV",
      "KeyB",
      "KeyN",
      "KeyM",
      "Comma",
      "Period",
      "Slash",
      "Space",
    ];
  }

  if (!keyEventCodes.includes(event.code)) {
    return null;
  }

  const layoutKeys = layout.keys;

  const layoutMap = layoutKeys.row1
    .concat(layoutKeys.row2)
    .concat(layoutKeys.row3)
    .concat(layoutKeys.row4)
    .concat(layoutKeys.row5);

  const mapIndex = keyEventCodes.indexOf(event.code);
  if (mapIndex === -1) {
    if (event.code.startsWith("Numpad")) {
      return event.key ?? null;
    } else {
      return null;
    }
  }
  const charVariant = emulatedLayoutGetVariant(
    event,
    layoutMap[mapIndex] ?? [],
  );
  if (charVariant !== undefined) {
    return charVariant;
  } else {
    return null;
  }
}
