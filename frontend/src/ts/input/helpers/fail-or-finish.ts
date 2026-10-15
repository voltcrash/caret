import * as Core from "@oxytype/typing-core/input/fail-or-finish";
import { getMutableConfig } from "../../config/store";
export function checkIfFailedDueToMinBurst(
  options: Parameters<typeof Core.checkIfFailedDueToMinBurst>[0],
): boolean {
  return Core.checkIfFailedDueToMinBurst(options, getMutableConfig());
}
export function checkIfFailedDueToDifficulty(
  options: Parameters<typeof Core.checkIfFailedDueToDifficulty>[0],
): boolean {
  return Core.checkIfFailedDueToDifficulty(options, getMutableConfig());
}
export function checkIfFinished(
  options: Parameters<typeof Core.checkIfFinished>[0],
): boolean {
  return Core.checkIfFinished(options, getMutableConfig());
}
