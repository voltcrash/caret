import { createAppSignal } from "../../app/state";

export const [isAppLoading, setAppLoading] = createAppSignal(true);
export const [getFontFamily, setFontFamily] = createAppSignal<string>();
export const [getFontFace, setFontFace] = createAppSignal("");
export const [getMediaQueryDebugLevel, setMediaQueryDebugLevel] =
  createAppSignal(0);

export const [isFocusCursorHidden, setFocusCursorHidden] =
  createAppSignal(false);
