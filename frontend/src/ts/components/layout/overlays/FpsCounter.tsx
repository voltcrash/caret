import { roundTo2 } from "@caret/util/numbers";
import { JSX, createSignal, createEffect, onCleanup, Show } from "solid-js";

import { createAppSignal } from "#app/state.ts";

const [isVisible, setVisible] = createAppSignal(false);

export function showFpsCounter(): void {
  setVisible(true);
}

export function hideFpsCounter(): void {
  setVisible(false);
}

export function FpsCounter(): JSX.Element {
  const [fps, setFps] = createSignal(0);

  createEffect(() => {
    if (!isVisible()) return;
    let frameCount = 0;
    let startTime = performance.now();
    const loop = (timestamp: number): void => {
      const elapsed = timestamp - startTime;
      frameCount++;
      if (elapsed > 500) {
        setFps(roundTo2((frameCount * 1000) / elapsed));
        frameCount = 0;
        startTime = timestamp;
      }
      frame = window.requestAnimationFrame(loop);
    };
    let frame = window.requestAnimationFrame(loop);
    onCleanup(() => window.cancelAnimationFrame(frame));
  });

  const fpsColor = (): string =>
    fps() > 55 ? "white" : fps() < 30 ? "red" : "yellow";

  return (
    <Show when={isVisible()}>
      <div
        class={"fixed top-0 left-0 z-9999 bg-sub-alt px-2 py-1"}
        style={{
          color: fpsColor(),
        }}
      >
        FPS {fps().toFixed(2)}
      </div>
    </Show>
  );
}
