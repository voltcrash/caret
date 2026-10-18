import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("animejs", () => ({ animate: vi.fn() }));

import { ResultCrown } from "../../../../../src/features/typing/components/result/ResultCrown";
import { setResultState } from "../../../../../src/ts/states/result";

function renderCrown(): HTMLElement {
  const { container } = render(() => <ResultCrown />);
  return container;
}

describe("ResultCrown", () => {
  afterEach(() => {
    cleanup();
    setResultState("crown", {
      visible: false,
      type: "normal",
      text: "",
      wide: false,
    });
  });

  it("renders nothing when hidden", () => {
    expect(renderCrown().querySelector(".crown")).toBeNull();
  });

  it("shows the type and hover text", () => {
    setResultState("crown", {
      visible: true,
      type: "warning",
      text: "not eligible",
      wide: true,
    });
    const crown = renderCrown().querySelector(".crown") as HTMLElement;

    expect(crown).toHaveClass("warning");
    expect(crown).toHaveAttribute("aria-label", "not eligible");
    expect(crown).toHaveAttribute("data-balloon-length", "medium");
    expect(crown.querySelector(".fa-exclamation-triangle")).toHaveClass(
      "opacity-100",
    );
    expect(crown.querySelector(".fa-crown")).toHaveClass("opacity-0");
  });

  it("updates the type in place", () => {
    setResultState("crown", { visible: true, type: "pending", text: "+1" });
    const container = renderCrown();
    const crown = container.querySelector(".crown") as HTMLElement;

    expect(crown).toHaveClass("pending");
    expect(crown).toHaveAttribute("data-balloon-length", "");

    setResultState("crown", "type", "error");
    expect(container.querySelector(".crown")).toBe(crown);
    expect(crown).toHaveClass("error");
    expect(crown).not.toHaveClass("pending");
    expect(crown.querySelector(".fa-question")).toHaveClass("opacity-100");
  });
});
