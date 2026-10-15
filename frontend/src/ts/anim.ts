import { reduceMotionParams } from "./utils/motion";
import { animate, AnimationParams, engine } from "animejs";
import { LocalStorageWithSchema } from "./utils/local-storage-with-schema";
import { z } from "zod";
import { createSignal } from "solid-js";
import { appSignal } from "../app/state";
import { envConfig } from "virtual:env-config";

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
  applyEngineSettings();
  return result;
}

export function getfpsLimit(): number {
  return fpsLimitSignal();
}

export function applyEngineSettings(): void {
  engine.pauseOnDocumentHidden = envConfig.isDevelopment;
  engine.fps = fpsLimit.get();
  engine.defaults.frameRate = fpsLimit.get();
}

export function setLowFpsMode(): void {
  engine.fps = 30;
  engine.defaults.frameRate = 30;
}

export function clearLowFpsMode(): void {
  engine.fps = fpsLimit.get();
  engine.defaults.frameRate = fpsLimit.get();
}

export async function animateAsync(
  element: HTMLElement | undefined,
  options: AnimationParams,
): Promise<void> {
  if (!element) return;
  await new Promise<void>((resolve) => {
    animate(
      element,
      reduceMotionParams({
        ...options,
        onComplete: (self) => {
          options.onComplete?.(self);
          resolve();
        },
      }),
    );
  });
}
