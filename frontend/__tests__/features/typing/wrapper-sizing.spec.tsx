import { createRoot } from "solid-js";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const mocks = vi.hoisted(() => ({ updateWordsWrapperHeight: vi.fn() }));
vi.mock("../../../src/features/typing/components/words/sizing", () => ({
  updateWordsWrapperHeight: mocks.updateWordsWrapperHeight,
}));

import { useWordsWrapperSizing } from "../../../src/features/typing/components/words/wrapper-sizing";

let resize: (width: number) => void;
let disconnect: ReturnType<typeof vi.fn>;
let frames: Map<number, FrameRequestCallback>;
let fonts: EventTarget;
let dispose: () => void;

function flushFrames(): void {
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(0);
}

beforeEach(() => {
  vi.clearAllMocks();
  disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = (width) =>
          callback(
            [{ contentRect: { width } } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  frames = new Map();
  let frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  fonts = new EventTarget();
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: fonts,
  });
  createRoot((done) => {
    dispose = done;
    useWordsWrapperSizing(document.createElement("div"));
  });
});

afterEach(() => {
  dispose();
  vi.unstubAllGlobals();
});

describe("useWordsWrapperSizing", () => {
  it("measures once per frame when the width changes", () => {
    resize(0);
    resize(400);
    flushFrames();
    expect(mocks.updateWordsWrapperHeight).toHaveBeenCalledTimes(1);
    expect(mocks.updateWordsWrapperHeight).toHaveBeenCalledWith(true);
  });

  it("ignores height only changes", () => {
    resize(400);
    flushFrames();
    resize(400);
    flushFrames();
    expect(mocks.updateWordsWrapperHeight).toHaveBeenCalledTimes(1);
  });

  it("measures after fonts load", () => {
    fonts.dispatchEvent(new Event("loadingdone"));
    flushFrames();
    expect(mocks.updateWordsWrapperHeight).toHaveBeenCalledTimes(1);
  });

  it("stops watching on cleanup", () => {
    resize(400);
    dispose();
    fonts.dispatchEvent(new Event("loadingdone"));
    flushFrames();
    expect(disconnect).toHaveBeenCalled();
    expect(mocks.updateWordsWrapperHeight).not.toHaveBeenCalled();
    dispose = () => undefined;
  });
});
