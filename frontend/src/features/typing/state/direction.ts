import { createAppSignal } from "#app/state.ts";

export const [isLanguageRightToLeft, setIsLanguageRightToLeft] =
  createAppSignal(false);

export const [isDirectionReversed, setIsDirectionReversed] =
  createAppSignal(false);
