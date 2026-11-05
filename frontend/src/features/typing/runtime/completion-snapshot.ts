import { captureAccount } from "../../../app/account-scope";
import { getAuthenticatedUser } from "../../../ts/auth-client";
import { getMutableConfig } from "../../../ts/config/store";
import { getCustomTextIndicator } from "../../../ts/states/core";
import {
  getBailedOut,
  getCurrentQuote,
  getIncompleteSeconds,
  getIncompleteTests,
  getRestartCount,
  isRepeated,
} from "../../../ts/states/test";
import { buildEventLog, getTestSession } from "./events/data";
import * as CustomText from "./custom-text";
import { words } from "./test-words";

/** Capture once after finalization, before any module/animation await. */
export function captureCompletionSnapshot(): CompletionSnapshot {
  return {
    eventLog: structuredClone(buildEventLog()),
    config: structuredClone(getMutableConfig()),
    quote: structuredClone(getCurrentQuote()),
    customText: structuredClone(CustomText.getData()),
    customIndicator: structuredClone(getCustomTextIndicator()),
    repeated: isRepeated() && getMutableConfig().mode !== "quote",
    bailedOut: getBailedOut(),
    incompleteTests: structuredClone(getIncompleteTests()),
    incompleteSeconds: getIncompleteSeconds(),
    restartCount: getRestartCount(),
    timestamp: Date.now(),
    failReason: getTestSession().getFinishReason() ?? "",
    words: words.get().map((word) => word.text),
    user: getAuthenticatedUser(),
    account: captureAccount(),
  };
}

export type CompletionSnapshot = {
  eventLog: ReturnType<typeof buildEventLog>;
  config: ReturnType<typeof getMutableConfig>;
  quote: ReturnType<typeof getCurrentQuote>;
  customText: ReturnType<typeof CustomText.getData>;
  customIndicator: ReturnType<typeof getCustomTextIndicator>;
  repeated: boolean;
  bailedOut: boolean;
  incompleteTests: ReturnType<typeof getIncompleteTests>;
  incompleteSeconds: number;
  restartCount: number;
  timestamp: number;
  failReason: string;
  words: string[];
  user: ReturnType<typeof getAuthenticatedUser>;
  account: ReturnType<typeof captureAccount>;
};
