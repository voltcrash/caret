import { batch } from "solid-js";
import { getTypingLifecycle } from "../../src/features/typing/lifecycle-controller";
import type { LifecyclePhase } from "../../src/features/typing/lifecycle-machine";

/** Reach a state through real transitions instead of independently setting flags. */
export function resetTypingLifecycle(phase: LifecyclePhase = "ready"): void {
  batch(() => {
    const controller = getTypingLifecycle();
    controller.send({ type: "UNMOUNT" });
    if (phase === "unmounted") return;
    controller.send({ type: "MOUNT" });
    if (phase === "waitingPreferences") return;
    const events = [
      "RESTART",
      "EXIT_DONE",
      "PREPARED",
      "ENTER_DONE",
      "START",
      "FINISH",
      "STOPPED",
      "COMPLETION_LOADED",
      "RESULT_BUILT",
      "RESULT_READY",
      "PRESENTED",
    ] as const;
    for (const type of events) {
      controller.send({ type });
      if (controller.state().phase === phase) return;
    }
    throw new Error(`Unsupported typing fixture phase: ${phase}`);
  });
}
