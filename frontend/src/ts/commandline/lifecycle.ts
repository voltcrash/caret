import * as ThemeController from "../controllers/theme-controller";
import { clearFontPreview } from "../ui";

import { getActivePage, setCommandlineSubgroup } from "../states/core";

import {
  hideModal as storeHideModal,
  hideModalAndClearChain as storeClearChain,
} from "../states/modals";

import { commandlineState } from "../states/commandline";

import { addCommandlineBackground } from "./suggestions";
import { hideWarning } from "./input-validation";

const MODAL_STORE_ID = "Commandline";

export function hide(clearModalChain = false): void {
  clearFontPreview();
  void ThemeController.clearPreview();
  commandlineState.isAnimating = true;
  if (clearModalChain) {
    storeClearChain(MODAL_STORE_ID);
  } else {
    storeHideModal(MODAL_STORE_ID);
  }
}

export function afterHideCommandline(): void {
  hideWarning();
  addCommandlineBackground();
  if (getActivePage() !== "test") {
    (document.activeElement as HTMLElement | undefined)?.blur();
  }
  commandlineState.isAnimating = false;
  commandlineState.subgroupOverride = null;
  commandlineState.open = false;
  setCommandlineSubgroup(null);
}

// the single list stays empty until something is typed. touch users often
// have no keyboard open, so they browse the grouped list until they search
export function onCommandlineBeforeHide(): void {
  clearFontPreview();
  void ThemeController.clearPreview();
  commandlineState.isAnimating = true;
}

export function onCommandlineBackdropClick(): void {
  hide();
}
