import { createAppSignal } from "#app/state.ts";

// live IME composition text, pushed from the compositionupdate/end events.
export const [getCompositionText, setCompositionText] = createAppSignal("");

export const [getKoreanStatus, setKoreanStatus] = createAppSignal(false);
