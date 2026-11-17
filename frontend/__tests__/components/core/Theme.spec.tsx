import { cleanup, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import {
  afterEach,
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vite-plus/test";

import { Theme } from "../../../src/ts/components/core/Theme";
import * as Loader from "../../../src/ts/states/loader-bar";
import * as ThemeSignal from "../../../src/ts/states/theme";

vi.mock("../../../src/ts/constants/themes", () => ({
  themes: {
    phantom: { hasCss: true },
    serika: {},
  },
}));

describe("Theme component", () => {
  const darkTheme: ReturnType<typeof ThemeSignal.getTheme> = {
    name: "phantom",
    bg: "#000",
    main: "#fff",
    caret: "#fff",
    sub: "#aaa",
    subAlt: "#888",
    text: "#fff",
    error: "#f00",
    errorExtra: "#c00",
    colorfulError: "#f55",
    colorfulErrorExtra: "#c55",
  };
  const [themeSignal, setThemeSignal] =
    createSignal<ReturnType<typeof ThemeSignal.getTheme>>(darkTheme);
  const themeSignalMock = vi.spyOn(ThemeSignal, "getTheme");
  const loaderShowMock = vi.spyOn(Loader, "showLoaderBar");
  const loaderHideMock = vi.spyOn(Loader, "hideLoaderBar");

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    loaderShowMock.mockClear();
    loaderHideMock.mockClear();
    themeSignalMock.mockImplementation(() => themeSignal());
    setThemeSignal({ ...darkTheme });
  });

  it("injects CSS variables based on theme", () => {
    const { style } = renderComponent();

    expect(style.innerHTML).toEqual(`
:root {
    --bg-color: #000;
    --main-color: #fff;
    --caret-color: #fff;
    --sub-color: #aaa;
    --sub-alt-color: #888;
    --text-color: #fff;
    --error-color: #f00;
    --error-extra-color: #c00;
    --colorful-error-color: #f55;
    --colorful-error-extra-color: #c55;
}`);
  });

  it("updates CSS variables based on signal", () => {
    setThemeSignal({ ...themeSignal(), name: "serika", bg: "#f00" });
    const { style } = renderComponent();

    expect(style.innerHTML).toContain("--bg-color: #f00;");
  });

  it("applies decorations synchronously without a stylesheet or loader", () => {
    const { css } = renderComponent();
    expect(css.textContent).toContain("@keyframes phantom-glow");
    expect(document.querySelector("link#currentTheme")).toBeNull();
    expect(loaderShowMock).not.toHaveBeenCalled();
    expect(loaderHideMock).not.toHaveBeenCalled();
  });

  it.each(["serika", "custom"] as const)(
    "clears decorations for %s",
    (name) => {
      const { css } = renderComponent();
      setThemeSignal({ ...themeSignal(), name });
      expect(css.textContent).toBe("");
    },
  );

  it("applies theme switches without waiting for the debounce", () => {
    const { style } = renderComponent();
    setThemeSignal({ ...themeSignal(), name: "serika_dark", bg: "#123" });

    expect(style.innerHTML).toContain("--bg-color: #123;");
  });

  it("applies colour edits without a second debounce", () => {
    const { style } = renderComponent();
    setThemeSignal({ ...themeSignal(), bg: "#456" });

    expect(style.innerHTML).toContain("--bg-color: #456;");
  });

  it("saves applied colours and replaces the startup palette", () => {
    localStorage.removeItem("themeColors");
    const bootstrap = document.createElement("style");
    bootstrap.id = "themeBootstrap";
    document.head.append(bootstrap);

    renderComponent();
    // the initial default theme must not replace the saved palette
    expect(localStorage.getItem("themeColors")).toBeNull();
    expect(bootstrap.isConnected).toBe(true);

    setThemeSignal({ ...themeSignal(), name: "serika_dark", bg: "#789" });

    expect(bootstrap.isConnected).toBe(false);
    expect(JSON.parse(localStorage.getItem("themeColors") ?? "{}")).toEqual(
      expect.objectContaining({ "bg-color": "#789", "main-color": "#fff" }),
    );
  });

  it("keeps preview colors out of storage and browser chrome", () => {
    const { style, favIcon, metaThemeColor } = renderComponent();
    setThemeSignal({ ...themeSignal(), name: "serika", bg: "#123" });
    const saved = localStorage.getItem("themeColors");
    const icon = favIcon.getAttribute("href");
    setThemeSignal({
      ...themeSignal(),
      name: "phantom",
      bg: "#456",
      preview: true,
    });

    expect(style.textContent).toContain("--bg-color: #456;");
    expect(localStorage.getItem("themeColors")).toBe(saved);
    expect(favIcon.getAttribute("href")).toBe(icon);
    expect(metaThemeColor.content).toBe("#123");

    setThemeSignal({ ...themeSignal(), preview: false });
    expect(metaThemeColor.content).toBe("#456");
    expect(localStorage.getItem("themeColors")).not.toBe(saved);
  });

  it("renders favicon", () => {
    const { favIcon } = renderComponent();

    expect(favIcon).toBeInTheDocument();
    expect(favIcon).toBeEmptyDOMElement();
  });

  function renderComponent(): {
    style: HTMLStyleElement;
    css: HTMLStyleElement;
    metaThemeColor: HTMLMetaElement;
    favIcon: HTMLElement;
  } {
    render(() => <Theme />);

    //wait for debounce
    vi.runAllTimers();

    //make sure content is rendered to the head, not the body
    const head = document.head;

    const style = head.querySelector<HTMLStyleElement>("style#theme");
    const css = head.querySelector<HTMLStyleElement>("style#currentTheme");
    const metaThemeColor = head.querySelector<HTMLMetaElement>(
      "meta#metaThemeColor",
    );
    const favIcon = head.querySelector<HTMLElement>("#favicon");
    if (
      style === null ||
      css === null ||
      metaThemeColor === null ||
      favIcon === null
    ) {
      throw new Error("Missing fixture theme metadata");
    }
    return { style, css, metaThemeColor, favIcon };
  }
});

// Browser module exports are sealed; register spies before imports run.
vi.mock("../../../src/ts/states/loader-bar", { spy: true });
vi.mock("../../../src/ts/states/theme", { spy: true });
