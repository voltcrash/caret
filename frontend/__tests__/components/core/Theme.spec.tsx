import { cleanup, render, fireEvent } from "@solidjs/testing-library";
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
import * as Notifications from "../../../src/ts/states/notifications";
import * as ThemeSignal from "../../../src/ts/states/theme";

vi.mock("../../../src/ts/constants/themes", () => ({
  themes: {
    dark: { hasCss: true },
    serika: {},
  },
}));

vi.mock("./FavIcon", () => ({
  FavIcon: () => <div id="favicon" />,
}));

describe("Theme component", () => {
  const darkTheme: ReturnType<typeof ThemeSignal.getTheme> = {
    name: "dark",
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
  const notificationAddMock = vi.spyOn(Notifications, "showNoticeNotification");

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    loaderShowMock.mockClear();
    loaderHideMock.mockClear();
    notificationAddMock.mockClear();
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

  it("loads CSS file and shows loader when theme has CSS", () => {
    const { css } = renderComponent();

    if (css === null) throw new Error("Missing fixture theme stylesheet");
    expect(css.getAttribute("href")).toBe("/themes/dark.css");
    expect(loaderShowMock).toHaveBeenCalledOnce();
    fireEvent.load(css);
    expect(loaderHideMock).toHaveBeenCalledOnce();
  });

  it("removes CSS when theme has no CSS", async () => {
    themeSignalMock.mockImplementation(() => ({
      ...themeSignal(),
      name: "serika",
    }));
    const { css } = renderComponent();
    expect(css).not.toBeInTheDocument();
  });

  it("removes CSS when theme is custom", async () => {
    themeSignalMock.mockImplementation(() => ({
      ...themeSignal(),
      name: "custom",
    }));
    const { css } = renderComponent();
    expect(css).not.toBeInTheDocument();
  });

  it("handles CSS load error", () => {
    const { css } = renderComponent();
    expect(loaderShowMock).toHaveBeenCalledOnce();
    if (css === null) throw new Error("Missing fixture theme stylesheet");
    fireEvent.error(css);
    expect(loaderHideMock).toHaveBeenCalledOnce();
    expect(notificationAddMock).toHaveBeenCalledWith("Failed to load theme");
  });

  it("applies theme switches without waiting for the debounce", () => {
    const { style } = renderComponent();
    setThemeSignal({ ...themeSignal(), name: "serika_dark", bg: "#123" });

    expect(style.innerHTML).toContain("--bg-color: #123;");
  });

  it("debounces colour edits within the same theme", () => {
    const { style } = renderComponent();
    setThemeSignal({ ...themeSignal(), bg: "#456" });

    expect(style.innerHTML).toContain("--bg-color: #000;");
    vi.runAllTimers();
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

  it("renders favicon", () => {
    const { favIcon } = renderComponent();

    expect(favIcon).toBeInTheDocument();
    expect(favIcon).toBeEmptyDOMElement(); //mocked
  });

  function renderComponent(): {
    style: HTMLStyleElement;
    css: HTMLLinkElement | null;
    metaThemeColor: HTMLMetaElement;
    favIcon: HTMLElement;
  } {
    render(() => <Theme />);

    //wait for debounce
    vi.runAllTimers();

    //make sure content is rendered to the head, not the body
    const head = document.head;

    const style = head.querySelector<HTMLStyleElement>("style#theme");
    const css = head.querySelector<HTMLLinkElement>("link#currentTheme");
    const metaThemeColor = head.querySelector<HTMLMetaElement>(
      "meta#metaThemeColor",
    );
    const favIcon = head.querySelector<HTMLElement>("#favicon");
    if (style === null || metaThemeColor === null || favIcon === null) {
      throw new Error("Missing fixture theme metadata");
    }
    return { style, css, metaThemeColor, favIcon };
  }
});
