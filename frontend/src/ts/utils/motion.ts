import type { AnimationParams } from "animejs";
import { applyReducedMotion } from "./misc";

export function reduceMotionParams(params: AnimationParams): AnimationParams {
  return applyReducedMotion(1) === 0
    ? { ...params, duration: 0, delay: 0, loop: false }
    : params;
}
