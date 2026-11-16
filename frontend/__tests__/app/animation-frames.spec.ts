import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { mountApplication } from "../../src/app/application";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/test-application";
import {
  requestDebouncedAnimationFrame,
  cancelPendingAnimationFrame,
  cancelPendingAnimationFramesStartingWith,
} from "../../src/ts/utils/debounced-animation-frame";

releaseTestApplication();
let app: ReturnType<typeof createTestApplication>;
let release: () => void;
const callbacks = new Map<number, FrameRequestCallback>();
let nextId = 0;
beforeEach(() => {
  app = createTestApplication();
  release = mountApplication(app.application);
  callbacks.clear();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++nextId;
    callbacks.set(id, callback);
    return id;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    callbacks.delete(id);
  });
});
afterEach(() => {
  app.dispose();
  release();
  vi.restoreAllMocks();
});
function flush(): void {
  const pending = [...callbacks.values()];
  callbacks.clear();
  for (const callback of pending) callback(0);
}

it("runs only the latest callback for a frame ID", () => {
  const first = vi.fn();
  const latest = vi.fn();
  requestDebouncedAnimationFrame("caret", first);
  requestDebouncedAnimationFrame("caret", latest);
  flush();
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledOnce();
});

it("cancels individual frames, prefixes and the disposed app", () => {
  const callback = vi.fn();
  requestDebouncedAnimationFrame("caret", callback);
  requestDebouncedAnimationFrame("words:size", callback);
  requestDebouncedAnimationFrame("other", callback);
  cancelPendingAnimationFrame("caret");
  cancelPendingAnimationFramesStartingWith("words:");
  expect(callbacks.size).toBe(1);
  app.dispose();
  flush();
  expect(callback).not.toHaveBeenCalled();
});

it("allows a callback to schedule its next frame", () => {
  const next = vi.fn();
  requestDebouncedAnimationFrame("caret", () =>
    requestDebouncedAnimationFrame("caret", next),
  );
  flush();
  expect(next).not.toHaveBeenCalled();
  flush();
  expect(next).toHaveBeenCalledOnce();
});
