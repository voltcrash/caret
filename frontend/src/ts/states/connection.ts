import { onCleanup, onMount } from "solid-js";
import { debounce } from "@oxytype/util/timing";
import { createAppOwned } from "../../app/application";
import { createAppSignal } from "../../app/state";
import { showSuccessNotification } from "./notifications";
import { connectionEvent } from "../events/connection";
import { addBanner, removeBanner } from "./banners";
import { isTestActive } from "./test";
const [getState, setState] = createAppSignal(true);
const state = createAppOwned(() => ({
  bannerId: undefined as number | undefined,
  bannerClosed: false,
}));
export function get(): boolean {
  return getState();
}
export function showOfflineBanner(): void {
  const current = state();
  if (current.bannerClosed) return;
  current.bannerId ??= addBanner({
    level: "notice",
    text: "No internet connection",
    icon: "fas fa-exclamation-triangle",
    onClose: () => {
      current.bannerClosed = true;
      current.bannerId = undefined;
    },
  });
}
export function useConnectionEvents(): void {
  const current = state();
  const handleState = debounce(5000, () => {
    if (getState()) {
      if (current.bannerId !== undefined) {
        showSuccessNotification("You're back online", {
          customTitle: "Connection",
        });
        removeBanner(current.bannerId);
        current.bannerId = undefined;
      }
      current.bannerClosed = false;
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
