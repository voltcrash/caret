import { animate } from "animejs";
import { createEffect } from "solid-js";

import { Anime } from "../../../../ts/components/common/anime";
import { getConfig } from "../../../../ts/config/store";
import { getBarTarget, showLiveStats } from "../../../../ts/states/live-stats";
import { cn } from "../../../../ts/utils/cn";
import { reduceMotionParams } from "../../../../ts/utils/motion";
import { liveStatsBgColor } from "./styles";

export function BarTimerProgress() {
  let barEl: HTMLElement | undefined;

  createEffect(() => {
    const target = getBarTarget();
    if (barEl === undefined) return;
    animate(barEl, reduceMotionParams(target));
  });

  const shown = () =>
    showLiveStats() &&
    getConfig.mode !== "zen" &&
    getConfig.timerStyle === "bar";

  return (
    <div class="relative z-99" style={{ opacity: getConfig.timerOpacity }}>
      <Anime
        initial={{ opacity: 0 }}
        animation={{ opacity: shown() ? 1 : 0, duration: 125 }}
      >
        <div
          ref={(el) => (barEl = el)}
          class={cn(
            "fixed top-0 left-0 z-[-1] h-2 w-screen",
            liveStatsBgColor(),
          )}
        ></div>
      </Anime>
    </div>
  );
}
