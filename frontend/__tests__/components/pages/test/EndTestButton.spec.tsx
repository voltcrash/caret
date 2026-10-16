import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const { finish } = vi.hoisted(() => ({ finish: vi.fn() }));

vi.mock("../../../../src/features/typing/runtime/test-logic", () => ({
  finish,
}));
vi.mock("../../../../src/ts/config/store", () => ({
  getConfig: { mode: "time", time: 0, words: 10 },
}));
vi.mock("../../../../src/ts/states/core", () => ({
  getCustomTextIndicator: () => undefined,
}));
vi.mock("../../../../src/ts/states/test", async () => {
  const { createSignal } = await import("solid-js");
  const [isTestActive, setTestActive] = createSignal(false);
  return { isTestActive, setTestActive, setBailedOut: vi.fn() };
});
vi.mock("../../../../src/features/typing/runtime/custom-text", () => ({
  getData: () => ({ limit: { mode: "word", value: 0 } }),
}));

import { EndTestButton } from "../../../../src/features/typing/components/EndTestButton";
import { setTestActive } from "../../../../src/ts/states/test";

describe("EndTestButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    setTestActive(true);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    setTestActive(false);
  });

  it("requires a second tap before ending an infinite test", () => {
    render(() => <EndTestButton />);
    fireEvent.click(screen.getByRole("button", { name: "end test" }));
    expect(finish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "tap again to end" }));
    expect(finish).toHaveBeenCalledOnce();
  });

  it("expires the confirmation after three seconds", () => {
    render(() => <EndTestButton />);
    fireEvent.click(screen.getByRole("button", { name: "end test" }));
    vi.advanceTimersByTime(3000);
    expect(
      screen.getByRole("button", { name: "end test" }),
    ).toBeInTheDocument();
    expect(finish).not.toHaveBeenCalled();
  });

  it("requires a fresh confirmation after restarting the test", () => {
    render(() => <EndTestButton />);
    fireEvent.click(screen.getByRole("button", { name: "end test" }));
    setTestActive(false);
    setTestActive(true);

    const button = screen.getByRole("button", { name: "end test" });
    fireEvent.click(button);
    expect(finish).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "tap again to end" }),
    ).toBeInTheDocument();
  });
});
