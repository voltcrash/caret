import { captureTypingRoute } from "../scope";
import { getTypingLifecycle } from "../lifecycle-controller";
import { animateAsync } from "../../../ts/anim";
import { updateClassNames } from "../../../ts/utils/cn";
import { applyReducedMotion } from "../../../ts/utils/misc";
import { getTypingTestElement } from "../../../ts/states/test-dom";
import { getBailedOut, isTestActive } from "../../../ts/states/test";
import {
  getTestSession,
  forceReleaseAllKeys,
  cleanupData,
} from "./events/data";
import {
  captureCompletionSnapshot,
  type CompletionSnapshot,
} from "./completion-snapshot";
import { prepareResultScreen } from "../../../ts/states/result";
import * as TestUI from "./test-ui";
import * as TestTimer from "./test-timer";

/** Claim completion before native acknowledgement can synchronously notify again. */
export async function finish(difficultyFailed = false): Promise<void> {
  const lifecycle = getTypingLifecycle();
  const route = captureTypingRoute();
  if (
    !isTestActive() ||
    !route.isCurrent() ||
    !lifecycle.send({ type: "FINISH" })
  ) {
    return;
  }
  const now = performance.now();
  let snapshot: CompletionSnapshot | undefined;
  let work:
    | ReturnType<(typeof import("./completion.client"))["createCompletion"]>
    | undefined;
  const resume = async (): Promise<void> => {
    const operation = lifecycle.capture();
    const lease = {
      isCurrent: () => operation.isCurrent() && route.isCurrent(),
    };
    try {
      if (lifecycle.state().phase === "completing.stopping") {
        TestTimer.clear();
        if (getBailedOut()) getTestSession().bailout(now);
        getTestSession().end(now);
        forceReleaseAllKeys();
        cleanupData();
        snapshot = captureCompletionSnapshot();
        TestUI.onTestFinish();
        operation.send("STOPPED");
      }
      if (lifecycle.state().phase === "completing.loading") {
        const [completion] = await operation.wait(
          Promise.all([
            import("./completion.client"),
            prepareResultScreen(),
            (async () => {
              await animateAsync(getTypingTestElement(), {
                opacity: 0,
                duration: applyReducedMotion(125),
              });
              if (!lease.isCurrent()) return;
              const element = getTypingTestElement();
              element.className = updateClassNames(
                element.className,
                "hidden",
                true,
              );
              operation.send("WORDS_HIDDEN");
            })(),
          ]),
          15_000,
        );
        if (!lease.isCurrent()) return;
        if (snapshot === undefined) {
          throw new Error("Completion snapshot is missing");
        }
        work ??= completion.createCompletion(snapshot, difficultyFailed);
        operation.send("COMPLETION_LOADED");
      }
      if (work === undefined) throw new Error("Completion work is missing");
      if (lifecycle.state().phase === "completing.building") {
        await operation.wait(work.build(lease), 15_000);
        if (!lease.isCurrent()) return;
        operation.send("RESULT_BUILT");
      }
      if (
        ["completing.presenting", "completing.revealing"].includes(
          lifecycle.state().phase,
        )
      ) {
        await operation.wait(work.present(lease), 15_000);
        if (!lease.isCurrent()) return;
        operation.send("RESULT_READY");
        operation.send("PRESENTED");
      }
      // The caller may await the original save, but saving never gates the UI.
      await work.saved();
    } catch (error) {
      if (!lease.isCurrent()) return;
      TestTimer.clear();
      lifecycle.send({ type: "FAIL", error, token: operation.token });
    }
  };
  lifecycle.recoverWith(resume);
  await resume();
}

export async function retryCompletion(): Promise<void> {
  await getTypingLifecycle().retry();
}
