import { createAppSignal } from "./state";

// Startup: the app is ready once the browser chrome and stored preferences
// have loaded; finished once the startup screen has faded away.
export const [isAppReady, setAppReady] = createAppSignal(false);
export const [isStartupFinished, setStartupFinished] = createAppSignal(false);
