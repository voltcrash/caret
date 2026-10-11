import { roundTo2 } from "@oxytype/util/numbers";
import { JSX, createSignal, createEffect, onCleanup, Show } from "solid-js";

const [isVisible, setVisible] = createSignal(false);

export function showFpsCounter(): void {
  setVisible(true);
}

export function hideFpsCounter(): void {
  setVisible(false);
}

export function FpsCounter(): JSX.Element {
  const [fps, setFps] = createSignal(0);

  let stopLoop = true;
  let frameCount = 0;
  let startTime: number;
  let frame: number | undefined;

  const loop = (timestamp: number): void => {
    if (stopLoop) return;
    const elapsedTime = timestamp - startTime;
    frameCount++;

    if (elapsedTime > 500) {
      const currentFps = roundTo2((frameCount * 1000) / elapsedTime);
      frameCount = 0;
      startTime = timestamp;
      setFps(currentFps);
    }

    frame = window.requestAnimationFrame(loop);
  };

  createEffect(() => {
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = undefined;
    if (isVisible()) {
      stopLoop = false;
      frameCount = 0;
      startTime = performance.now();
      frame = window.requestAnimationFrame(loop);
    } else {
      stopLoop = true;
    }
  });

  onCleanup(() => {
    stopLoop = true;
    if (frame !== undefined) window.cancelAnimationFrame(frame);
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
