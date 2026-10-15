import { result } from "./context";
import { getMutableConfig } from "../../config/store";
import * as DB from "../../db";
import { getActiveFunboxes } from "../funbox/list";
import { getFunbox } from "@oxytype/funbox";
import {
  resultState,
  setResultState,
  type ResultCrownType,
} from "../../states/result";
import { buildCrown, type CanGetPb } from "../result-view-model";

export function showCrown(type: ResultCrownType): void {
  setResultState("crown", { visible: true, type });
}

function updateCrownText(text: string, wide = false): void {
  setResultState("crown", { text, wide });
}

export async function updateCrown(dontSave: boolean): Promise<void> {
  if (getMutableConfig().mode === "quote" || dontSave) {
    hideCrown();
    return;
  }

  const canGetPb = await resultCanGetPb();

  console.debug("Result can get PB:", canGetPb.value, canGetPb.reason ?? "");

  const localPb = DB.getLocalPB(
    getMutableConfig().mode,
    result.mode2,
    getMutableConfig().punctuation,
    getMutableConfig().numbers,
    getMutableConfig().language,
    getMutableConfig().difficulty,
    getMutableConfig().lazyMode,
    canGetPb.value ? getActiveFunboxes() : [],
  );
  const localPbWpm = localPb?.wpm ?? 0;
  const pbDiff = result.wpm - localPbWpm;
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
  const funboxes = result.funbox;
  const funboxObjects = getFunbox(result.funbox);
  const allFunboxesCanGetPb = funboxObjects.every((f) => f?.canGetPb);

  const funboxesOk = funboxes.length === 0 || allFunboxesCanGetPb;
  // allow stopOnError:letter to be PB only if 100% accuracy, since it doesn't affect gameplay
  const stopOnLetterTriggered =
    getMutableConfig().stopOnError === "letter" && result.acc < 100;
  const notBailedOut = !result.bailedOut;

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
