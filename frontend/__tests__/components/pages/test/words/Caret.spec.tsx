import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const bindings = vi.hoisted(() => ({
  main: vi.fn(),
  pace: vi.fn(),
  disposeMain: vi.fn(),
  disposePace: vi.fn(),
}));
vi.mock("../../../../../src/ts/test/caret", () => ({
  bindCaret: bindings.main,
}));
vi.mock("../../../../../src/ts/test/pace-caret", () => ({
  bindCaret: bindings.pace,
}));
import { Caret } from "../../../../../src/ts/components/pages/test/words/Caret";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Caret ownership", () => {
  it("binds the supplied nodes and disposes both animation controllers", () => {
    bindings.main.mockReturnValue(bindings.disposeMain);
    bindings.pace.mockReturnValue(bindings.disposePace);
    const mainRef = vi.fn();
    const paceRef = vi.fn();
    const { container, unmount } = render(() => (
      <>
        <Caret ref={mainRef} />
        <Caret pace ref={paceRef} />
      </>
    ));
    const main = container.querySelector("#caret");
    const pace = container.querySelector("#paceCaret");
    expect(mainRef).toHaveBeenCalledWith(main);
    expect(paceRef).toHaveBeenCalledWith(pace);
    expect(bindings.main).toHaveBeenCalledWith(main);
    expect(bindings.pace).toHaveBeenCalledWith(pace);
    expect(pace).toHaveClass("hidden");
    unmount();
    expect(bindings.disposeMain).toHaveBeenCalledOnce();
    expect(bindings.disposePace).toHaveBeenCalledOnce();
  });
});
