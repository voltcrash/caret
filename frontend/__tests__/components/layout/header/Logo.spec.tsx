import { fireEvent, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

const { showModal } = vi.hoisted(() => ({ showModal: vi.fn() }));
vi.mock("../../../../src/ts/states/modals", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../../../src/ts/states/modals")
  >()),
  showModal,
}));

import { TypingRouteHost } from "../../../../src/components/typing-route-host";
import { Logo } from "../../../../src/ts/components/layout/header/Logo";
import { restartTestEvent } from "../../../../src/ts/events/test";
import {
  getCommandlineSubgroup,
  setCommandlineSubgroup,
  setThemeIndicator,
} from "../../../../src/ts/states/core";

describe("Logo", () => {
  const [typing, setTyping] = createSignal(false);
  beforeEach(() => {
    setTyping(false);
    showModal.mockClear();
    setCommandlineSubgroup(null);
    setThemeIndicator({ text: "serika dark", isFavorite: false });
  });

  function renderLogo(): ReturnType<typeof render> {
    const view = render(() => (
      <TypingRouteHost.Provider value={typing}>
        <Logo />
      </TypingRouteHost.Provider>
    ));
    // Observe the anchor click without navigating the test runner iframe.
    view
      .getByRole("link", { name: "Oxytype Home" })
      .addEventListener("click", (event) => event.preventDefault());
    return view;
  }

  it("has no tagline", () => {
    const view = renderLogo();
    expect(view.container).not.toHaveTextContent("type with focus");
  });

  it("links the icon and wordmark home without nesting the theme button", () => {
    const view = renderLogo();
    const home = view.getByRole("link", { name: "Oxytype Home" });
    expect(home).toHaveAttribute("href", "/");
    expect(home).toHaveTextContent("oxytype");
    expect(home.querySelector("svg")).not.toBeNull();
    expect(home.querySelector("button")).toBeNull();
  });

  it.each(["icon", "wordmark"])(
    "restarts the test from the %s on the typing route without opening themes",
    (target) => {
      setTyping(true);
      const restart = vi.fn();
      const unsubscribe = restartTestEvent.subscribe(restart);
      try {
        const view = renderLogo();
        const home = view.getByRole("link", { name: "Oxytype Home" });
        const element =
          target === "icon"
            ? home.querySelector("svg")
            : view.getByText("oxytype");
        if (element === null) throw new Error("Logo icon missing");
        fireEvent.click(element);
        expect(restart).toHaveBeenCalledOnce();
        expect(showModal).not.toHaveBeenCalled();
        expect(getCommandlineSubgroup()).toBeNull();
      } finally {
        unsubscribe();
      }
    },
  );

  it("navigates home from the wordmark on other routes without restarting", () => {
    const restart = vi.fn();
    const unsubscribe = restartTestEvent.subscribe(restart);
    try {
      const view = renderLogo();
      fireEvent.click(view.getByText("oxytype"));
      expect(restart).not.toHaveBeenCalled();
      expect(showModal).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it("shows the current theme name under the logo text", () => {
    const view = renderLogo();
    setThemeIndicator({ text: "aether", isFavorite: false });
    const indicator = view.getByRole("button", {
      name: "Shift-click to toggle custom theme",
    });
    expect(indicator).toHaveTextContent("aether");
    fireEvent.click(indicator);
    expect(getCommandlineSubgroup()).toBe("themes");
    expect(showModal).toHaveBeenCalledWith("Commandline");
  });

  it("shows no star for a favorite theme", () => {
    const view = renderLogo();
    setThemeIndicator({ text: "aether", isFavorite: true });
    const indicator = view.getByRole("button", {
      name: "Shift-click to toggle custom theme",
    });
    expect(indicator).toHaveTextContent("aether");
    expect(indicator.querySelector(".fa-star")).toBeNull();
  });
});
