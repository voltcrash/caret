import { createSignal } from "solid-js";
import { z } from "zod";

import { createAppOwned } from "../app/application";
import { appSignal } from "../app/state";
import { LocalStorageWithSchema } from "./utils/local-storage-with-schema";
import { applyReducedMotion } from "./utils/misc";

export const fpsLimitSchema = z.number().int().min(15).max(1000);

const fpsLimit = new LocalStorageWithSchema({
  key: "fpsLimit",
  schema: fpsLimitSchema,
  fallback: 1000,
});

const [fpsLimitSignal, setFpsLimitSignal] = appSignal(() =>
  createSignal(fpsLimit.get()),
);

export function setfpsLimit(fps: number): boolean {
  const result = fpsLimit.set(fps);
  if (result) {
    setFpsLimitSignal(fps);
  }
  return result;
}

export function getfpsLimit(): number {
  return fpsLimitSignal();
}

export type AnimateAsyncOptions = {
  opacity: number | [number, number];
  duration?: number;
  easing?: string;
  onBegin?: () => void;
  onComplete?: () => void;
};

const activeAnimations = createAppOwned(
  () => new WeakMap<HTMLElement, Animation>(),
);

function readCurrentOpacity(element: HTMLElement): number {
  const inline = parseFloat(element.style.opacity);
  if (!Number.isNaN(inline)) return inline;
  const computed = parseFloat(window.getComputedStyle(element).opacity);
  return Number.isNaN(computed) ? 1 : computed;
}

export async function animateAsync(
  element: HTMLElement | undefined,
  options: AnimateAsyncOptions,
): Promise<void> {
  if (!element) return;

  const animations = activeAnimations();
  const previous = animations.get(element);
  if (previous !== undefined) {
    if (previous.playState !== "finished") {
      try {
        previous.commitStyles();
      } catch {
        // Unrendered elements cannot commit; fall back to inline/computed opacity.
      }
    }
    previous.cancel();
    animations.delete(element);
  }

  options.onBegin?.();

  const [from, to] = Array.isArray(options.opacity)
    ? options.opacity
    : [readCurrentOpacity(element), options.opacity];

  const duration = applyReducedMotion(options.duration ?? 0);
  element.style.opacity = String(to);

  if (duration <= 0 || from === to) {
    options.onComplete?.();
    return;
  }

  const animation = element.animate(
    { opacity: [String(from), String(to)] },
    { duration, easing: options.easing ?? "ease-out" },
  );
  animations.set(element, animation);

  try {
    await animation.finished;
  } catch {
    return;
  }

  if (animations.get(element) === animation) {
    animations.delete(element);
    options.onComplete?.();
  }
}
