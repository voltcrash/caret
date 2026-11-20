import { captureTypingPresentation } from "../../scope";
import { currentResult } from "./context";
import { peekConfig } from "#shared/config/store.ts";
import * as DB from "#shared/db.ts";
import { getActiveFunboxes } from "../funbox/list";
import { getFunbox } from "@caret/funbox";
import {
  resultState,
  setResultState,
  type ResultCrownType,
} from "../../state/result";
import { buildCrown, type CanGetPb } from "./view-model";

export function showCrown(type: ResultCrownType): void {
  setResultState("crown", { visible: true, type });
}

function updateCrownText(text: string, wide = false): void {
  setResultState("crown", { text, wide });
}

export async function updateCrown(dontSave: boolean): Promise<void> {
  if (peekConfig().mode === "quote" || dontSave) {
    hideCrown();
    return;
  }

  const lease = captureTypingPresentation();
  const canGetPb = await resultCanGetPb();
  if (!lease.isCurrent()) return;

  console.debug("Result can get PB:", canGetPb.value, canGetPb.reason ?? "");

  const localPb = DB.getLocalPB(
    peekConfig().mode,
    currentResult().mode2,
    peekConfig().punctuation,
    peekConfig().numbers,
    peekConfig().language,
    peekConfig().difficulty,
    peekConfig().lazyMode,
    canGetPb.value ? getActiveFunboxes() : [],
  );
  const localPbWpm = localPb?.wpm ?? 0;
  const pbDiff = currentResult().wpm - localPbWpm;
  console.debug("Local PB", localPb, "diff", pbDiff);

  const crown = buildCrown(canGetPb, pbDiff);
  if (crown === null) {
    hideCrown();
    console.debug("Hiding crown");
    return;
  }
  console.debug(`Showing ${crown.type} crown`);
  showCrown(crown.type);
  updateCrownText(crown.text, crown.wide);
}

export function hideCrown(): void {
  setResultState("crown", { visible: false, text: "", wide: false });
}

export function showErrorCrownIfNeeded(): void {
  if (resultState.crown.type !== "pending") return;
  showCrown("error");
  updateCrownText(
    `Local PB data is out of sync with the server - please refresh (pb mismatch)`,
    true,
  );
}

export async function resultCanGetPb(): Promise<CanGetPb> {
  const funboxes = currentResult().funbox;
  const funboxObjects = getFunbox(currentResult().funbox);
  const allFunboxesCanGetPb = funboxObjects.every((f) => f?.canGetPb);

  const funboxesOk = funboxes.length === 0 || allFunboxesCanGetPb;
  // allow stopOnError:letter to be PB only if 100% accuracy, since it doesn't affect gameplay
  const stopOnLetterTriggered =
    peekConfig().stopOnError === "letter" && currentResult().acc < 100;
  const notBailedOut = !currentResult().bailedOut;

  if (funboxesOk && !stopOnLetterTriggered && notBailedOut) {
    return {
      value: true,
    };
  } else {
    if (!funboxesOk) {
      return {
        value: false,
        reason: "funbox",
      };
    }
    if (stopOnLetterTriggered) {
      return {
        value: false,
        reason: "stop on letter",
      };
    }
    if (!notBailedOut) {
      return {
        value: false,
        reason: "bailed out",
      };
    }
    return {
      value: false,
      reason: "unknown",
    };
  }
}
