import { createEffect, onCleanup } from "solid-js";

import { Anime } from "../../../../ts/components/common/anime";
import { getConfig } from "../../../../ts/config/store";
import { getBarTarget, showLiveStats } from "../../../../ts/states/live-stats";
import { cn } from "../../../../ts/utils/cn";
import { applyReducedMotion } from "../../../../ts/utils/misc";
import { liveStatsBgColor } from "./styles";

// anime.js's default `out(2)`, which the bar used before.
const BAR_EASE = "cubic-bezier(0.5, 1, 0.89, 1)";
const FADE_MS = 125;

export function BarTimerProgress() {
  let barEl: HTMLElement | undefined;
  let animation: Animation | undefined;
  // Finishing hides the bar as it fills; the fill still animates while the
  // bar fades out, but nothing animates once the fade has ended.
  let wasShown = false;
  let hiddenAt = Number.NEGATIVE_INFINITY;

  const shown = () =>
    showLiveStats() &&
    getConfig.mode !== "zen" &&
    getConfig.timerStyle === "bar";

  // The bar fills by scaling on the compositor: animating its width relaid
  // out the page every frame of a test, even while the bar was hidden.
  createEffect(() => {
    const target = getBarTarget();
    const visible = shown();
    if (barEl === undefined) return;
    const to = `${parseFloat(target.width) / 100} 1`;
    let from = barEl.style.scale || "1 1";
    if (animation !== undefined) {
      if (animation.playState !== "finished") {
        try {
          animation.commitStyles();
          from = barEl.style.scale || from;
        } catch {
          // Unrendered elements cannot commit; the glide restarts from `from`.
        }
      }
      animation.cancel();
      animation = undefined;
    }
    barEl.style.scale = to;
    if (wasShown && !visible) hiddenAt = performance.now();
    wasShown = visible;
    // A hidden bar only animates for what is left of its fade.
    const fadeLeft = Math.max(0, FADE_MS - (performance.now() - hiddenAt));
    const duration = applyReducedMotion(
      visible ? target.duration : Math.min(target.duration, fadeLeft),
    );
    if (duration > 0 && from !== to) {
      animation = barEl.animate(
        { scale: [from, to] },
        {
          duration,
          easing: target.ease === "linear" ? "linear" : BAR_EASE,
        },
      );
    }
  });
  onCleanup(() => animation?.cancel());

  return (
    <div class="relative z-99" style={{ opacity: getConfig.timerOpacity }}>
      <Anime
        initial={{ opacity: 0 }}
        animation={{ opacity: shown() ? 1 : 0, duration: FADE_MS }}
      >
        <div
          ref={(el) => (barEl = el)}
          class={cn(
            "fixed top-0 left-0 z-[-1] h-2 w-screen origin-left",
            liveStatsBgColor(),
          )}
        ></div>
      </Anime>
    </div>
  );
}
