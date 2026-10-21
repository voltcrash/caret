import { captureTypingRoute } from "../scope";
import { animateAsync } from "../../../ts/anim";
import { updateClassNames } from "../../../ts/utils/cn";
import { applyReducedMotion, sleep } from "../../../ts/utils/misc";
import { getTypingTestElement } from "../../../ts/states/test-dom";
import {
  isTestActive,
  isResultCalculating,
  setResultCalculating,
  setResultLoading,
} from "../../../ts/states/test";
import { getTestSession } from "./events/data";
import * as TestTimer from "./test-timer";

/** Stop the clock synchronously; result-only code loads during the fade. */
export async function finish(difficultyFailed = false): Promise<void> {
  const lease = captureTypingRoute();
  if (!isTestActive() || isResultCalculating() || !lease.isCurrent()) return;
  setResultCalculating(true);
  const now = performance.now();
  TestTimer.clear();
  getTestSession().end(now);

  const [completion] = await Promise.all([
    import("./completion.client"),
    (async () => {
      await animateAsync(getTypingTestElement(), {
        opacity: 0,
        duration: applyReducedMotion(125),
      });
      if (!lease.isCurrent()) return;
      const typingTest = getTypingTestElement();
      typingTest.className = updateClassNames(
        typingTest.className,
        "hidden",
        true,
      );
      setResultLoading(true);
      await sleep(0);
    })(),
  ]);
  if (!lease.isCurrent()) return;
  await completion.finish(difficultyFailed, lease);
}
