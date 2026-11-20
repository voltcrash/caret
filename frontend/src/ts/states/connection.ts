import { createEffect, onCleanup, onMount } from "solid-js";
import { debounce } from "@caret/util/timing";
import { createAppOwned } from "../../app/application";
import { createAppSignal } from "../../app/state";
import { showSuccessNotification } from "./notifications";
import { connectionEvent } from "../events/connection";
import { addBanner, removeBanner } from "./banners";
import { isTestActive } from "./test";
const [getState, setState] = createAppSignal(true);
type OfflineBanner =
  | { phase: "eligible" | "dismissed" }
  | { phase: "visible"; id: number };
const state = createAppOwned((): { banner: OfflineBanner } => ({
  banner: { phase: "eligible" },
}));
export function get(): boolean {
  return getState();
}
export function showOfflineBanner(): void {
  const current = state();
  if (current.banner.phase !== "eligible") return;
  const id = addBanner({
    level: "notice",
    text: "No internet connection",
    icon: "fas fa-exclamation-triangle",
    onClose: () => {
      current.banner = { phase: "dismissed" };
    },
  });
  current.banner = { phase: "visible", id };
}
export function useConnectionEvents(): void {
  const current = state();
  createEffect(() => {
    if (!getState() && !isTestActive()) showOfflineBanner();
  });
  const handleState = debounce(5000, () => {
    if (getState()) {
      if (current.banner.phase === "visible") {
        showSuccessNotification("You're back online", {
          customTitle: "Connection",
        });
        removeBanner(current.banner.id);
      }
      current.banner = { phase: "eligible" };
    } else if (!isTestActive()) {
      showOfflineBanner();
    }
  });
  connectionEvent.useListener((value) => {
    setState(value);
    handleState();
  });
  onMount(() => {
    setState(navigator.onLine);
    if (!getState()) showOfflineBanner();
  });
  onCleanup(() => handleState.cancel());
}
