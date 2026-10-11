import { cleanup, render } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import { useWordsInputScroll } from "../../src/ts/hooks/useWordsInputScroll";
import { centerWordsInputEvent } from "../../src/ts/states/words-layout";
import { isCoarsePointer } from "../../src/ts/utils/pointer";

vi.mock("../../src/ts/utils/pointer", () => ({
  isCoarsePointer: vi.fn(() => false),
}));

let wrapper: HTMLDivElement;
let input: HTMLTextAreaElement;
let height: number;
let top: number;
const scroll = vi.fn();

beforeEach(() => {
  height = 900;
  top = 600;
  wrapper = document.createElement("div");
  input = document.createElement("textarea");
  wrapper.append(input);
  document.body.append(wrapper);
  vi.mocked(isCoarsePointer).mockReturnValue(false);
  Object.defineProperty(wrapper, "offsetHeight", { get: () => height });
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
  vi.spyOn(input, "getBoundingClientRect").mockImplementation(
    () => ({ top, height: 30 }) as DOMRect,
  );
  input.scrollIntoView = scroll;
  scroll.mockClear();
});
afterEach(() => {
  cleanup();
  wrapper.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function mount(): ReturnType<typeof render> {
  return render(() => {
    useWordsInputScroll(wrapper, input);
    return null;
  });
}

describe("words input centering", () => {
  it("centers input only when an oversized wrapper puts it below center", () => {
    mount();
    centerWordsInputEvent.dispatch(false);
    expect(scroll).toHaveBeenCalledWith({ block: "center" });
    top = 400;
    centerWordsInputEvent.dispatch(false);
    top = 0;
    centerWordsInputEvent.dispatch(false);
    expect(scroll).toHaveBeenCalledOnce();
  });
  it("forces centering but never scrolls a wrapper that fits the viewport", () => {
    mount();
    top = 0;
    centerWordsInputEvent.dispatch(true);
    expect(scroll).toHaveBeenCalledOnce();
    height = 799;
    centerWordsInputEvent.dispatch(true);
    expect(scroll).toHaveBeenCalledOnce();
    height = 800;
    centerWordsInputEvent.dispatch(true);
    expect(scroll).toHaveBeenCalledTimes(2);
  });
  it("removes the scrolling listener when its component disposes", () => {
    const { unmount } = mount();
    unmount();
    centerWordsInputEvent.dispatch(true);
    expect(scroll).not.toHaveBeenCalled();
  });

  describe("phone keyboard", () => {
    let viewport: EventTarget & { height: number; offsetTop: number };
    let scrollBy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.mocked(isCoarsePointer).mockReturnValue(true);
      viewport = Object.assign(new EventTarget(), {
        height: 400,
        offsetTop: 50,
      });
      vi.stubGlobal("visualViewport", viewport);
      scrollBy = vi
        .spyOn(window, "scrollBy")
        .mockImplementation(() => undefined);
      input.focus();
    });

    it("uses the visible viewport offset and scrolls immediately above the keyboard", () => {
      mount();
      centerWordsInputEvent.dispatch(false);
      expect(scrollBy).toHaveBeenCalledWith({ top: 425, behavior: "instant" });
      expect(scroll).not.toHaveBeenCalled();
    });

    it("does not move a line already in the visible typing band", () => {
      mount();
      top = 150;
      centerWordsInputEvent.dispatch(false);
      viewport.dispatchEvent(new Event("resize"));
      expect(scrollBy).not.toHaveBeenCalled();
    });

    it("repositions on keyboard resize and removes the listener on disposal", () => {
      const { unmount } = mount();
      viewport.height = 300;
      viewport.dispatchEvent(new Event("resize"));
      expect(scrollBy).toHaveBeenCalledWith({ top: 460, behavior: "instant" });
      unmount();
      viewport.dispatchEvent(new Event("resize"));
      expect(scrollBy).toHaveBeenCalledOnce();
    });

    it("does not reposition when the words input loses focus", () => {
      mount();
      input.blur();
      viewport.dispatchEvent(new Event("resize"));
      expect(scrollBy).not.toHaveBeenCalled();
    });

    it("mounts without a visual viewport", () => {
      vi.stubGlobal("visualViewport", undefined);
      expect(() => mount()).not.toThrow();
      centerWordsInputEvent.dispatch(false);
      expect(scrollBy).not.toHaveBeenCalled();
    });
  });
});
