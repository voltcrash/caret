import { createWeakSpot } from "@oxytype/typing-core/weak-spot";
import { getLiveCachedMsSinceLastInputEvent } from "./events/live-cache";
const learner = createWeakSpot();
export const getWord = learner.getWord;
export function updateScore(char: string, correct: boolean): void {
  learner.updateScore(char, correct, getLiveCachedMsSinceLastInputEvent());
}
