import { onCleanup } from "solid-js";
import { createAppOwned } from "../../app/application";
const getFrames = createAppOwned(() => {
  const frames = new Map<string, { id: number; callback: () => void }>();
  onCleanup(() => {
    for (const frame of frames.values()) cancelAnimationFrame(frame.id);
    frames.clear();
  });
  return frames;
});

export function requestDebouncedAnimationFrame(
  frameId: string,
  callback: () => void,
): void {
  const pendingFrames = getFrames();
  const pending = pendingFrames.get(frameId);
  if (pending !== undefined) {
    pending.callback = callback;
    return;
  }
  const frame = { id: 0, callback };
  frame.id = requestAnimationFrame(() => {
    pendingFrames.delete(frameId);
    frame.callback();
  });
  pendingFrames.set(frameId, frame);
}

function cancelIfPending(frameId: string): void {
  const pendingFrames = getFrames();
  const pending = pendingFrames.get(frameId);
  if (pending !== undefined) {
    cancelAnimationFrame(pending.id);
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
