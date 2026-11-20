import { getCommandlineState } from "../states/commandline";
import * as ThemeController from "../controllers/theme-controller";
import { clearFontPreview } from "../ui";

import { isTypingRouteActive } from "../typing-host";
import { setCommandlineSubgroup } from "../states/core";

import {
  hideModal as storeHideModal,
  hideModalAndClearChain as storeClearChain,
} from "../states/modals";

import { addCommandlineBackground } from "./suggestions";
import { hideWarning } from "./input-validation";

const MODAL_STORE_ID = "Commandline";

export function hide(clearModalChain = false): void {
  const commandlineState = getCommandlineState();
  clearFontPreview();
  void ThemeController.clearPreview();
  if (commandlineState.phase === "open") commandlineState.phase = "closing";
  if (clearModalChain) {
    storeClearChain(MODAL_STORE_ID);
  } else {
    storeHideModal(MODAL_STORE_ID);
  }
}

export function afterHideCommandline(): void {
  const commandlineState = getCommandlineState();
  hideWarning();
  addCommandlineBackground();
  if (!isTypingRouteActive()) {
    (document.activeElement as HTMLElement | undefined)?.blur();
  }
  commandlineState.subgroupOverride = null;
  commandlineState.phase = "closed";
  setCommandlineSubgroup(null);
}

// the single list stays empty until something is typed. touch users often
// have no keyboard open, so they browse the grouped list until they search
export function onCommandlineBeforeHide(): void {
  const commandlineState = getCommandlineState();
  clearFontPreview();
  void ThemeController.clearPreview();
  if (commandlineState.phase === "open") commandlineState.phase = "closing";
}

export function onCommandlineBackdropClick(): void {
  hide();
}
