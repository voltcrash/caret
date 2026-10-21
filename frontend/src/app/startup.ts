import { createAppSignal } from "./state";

// Chrome readiness covers browser chrome and stored preferences.
// Startup finishes once the startup screen has faded away.
export const [isChromeReady, setChromeReady] = createAppSignal(false);
// The current typing mount has initialized its first test or exposed an error.
export const [isTypingReady, setTypingReady] = createAppSignal(false);
export const [isStartupFinished, setStartupFinished] = createAppSignal(false);
