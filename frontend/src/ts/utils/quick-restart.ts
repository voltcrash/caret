import type { CustomTextSettings } from "@oxytype/schemas/results";
import { projectEngineConfig } from "@oxytype/typing-engine/config";
import {
  enginePolicy,
  enginePolicyReady,
} from "../../features/typing/policy.client";

/** Undefined until native policies load; loading UI must not infer a restriction. */
export function canQuickRestart(
  mode: string,
  words: number,
  time: number,
  custom: CustomTextSettings,
  customIsLong: boolean,
): boolean | undefined {
  if (!enginePolicyReady()) {
    return undefined;
  }
  return enginePolicy({
    op: "quickRestart",
    config: projectEngineConfig({ mode, words, time }),
    limit: custom.limit,
    customIsLong,
  }).result;
}
