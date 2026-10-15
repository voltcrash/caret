import { onCleanup } from "solid-js";
import { createAppOwned } from "../../app/application";
const getFrames = createAppOwned(() => {
  const frames = new Map<string, number>();
  onCleanup(() => {
    for (const frame of frames.values()) cancelAnimationFrame(frame);
    frames.clear();
  });
  return frames;
});

export function requestDebouncedAnimationFrame(
  frameId: string,
  callback: () => void,
): void {
  const pendingFrames = getFrames();
  cancelIfPending(frameId);
  const frame = requestAnimationFrame(() => {
    pendingFrames.delete(frameId);
    callback();
  });
  pendingFrames.set(frameId, frame);
}

function cancelIfPending(frameId: string): void {
  const pendingFrames = getFrames();
  const pending = pendingFrames.get(frameId);
  if (pending !== undefined) {
    cancelAnimationFrame(pending);
    pendingFrames.delete(frameId);
  }
}

export function cancelPendingAnimationFrame(frameId: string): void {
  cancelIfPending(frameId);
}

export function cancelPendingAnimationFramesStartingWith(prefix: string): void {
  for (const frameId of getFrames().keys()) {
    if (frameId.startsWith(prefix)) {
      cancelIfPending(frameId);
    }
  }
}
