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
    return render(() => (
      <TypingRouteHost.Provider value={typing}>
        <Logo />
      </TypingRouteHost.Provider>
    ));
  }

  it("has no tagline", () => {
    const view = renderLogo();
    expect(view.container).not.toHaveTextContent("type with focus");
  });

  it("links only the icon home", () => {
    const view = renderLogo();
    const home = view.getByRole("link", { name: "Oxytype Home" });
    expect(home).toHaveAttribute("href", "/");
    expect(home).not.toHaveTextContent("oxytype");
    expect(home.querySelector("svg")).not.toBeNull();
  });

  it("restarts the test from the icon on the typing route", () => {
    setTyping(true);
    const restart = vi.fn();
    const unsubscribe = restartTestEvent.subscribe(restart);
    try {
      const view = renderLogo();
      fireEvent.click(view.getByRole("link", { name: "Oxytype Home" }));
      expect(restart).toHaveBeenCalledOnce();
    } finally {
      unsubscribe();
    }
  });

  it("opens the theme picker from the logo text", () => {
    const view = renderLogo();
    fireEvent.click(
      view.getByRole("button", { name: "oxytype - change theme" }),
    );
    expect(getCommandlineSubgroup()).toBe("themes");
    expect(showModal).toHaveBeenCalledWith("Commandline");
  });

  it("shows the current theme name under the logo text", () => {
    const view = renderLogo();
    setThemeIndicator({ text: "aether", isFavorite: false });
    const indicator = view.getByRole("button", {
      name: "Shift-click to toggle custom theme",
    });
    expect(indicator).toHaveTextContent("aether");
    fireEvent.click(indicator);
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
