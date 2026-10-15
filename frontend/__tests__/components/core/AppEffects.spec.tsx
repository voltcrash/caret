import { cleanup, render, waitFor } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import { FontRuntime } from "../../../src/app/font-runtime.client";

const { deferred, lifecycle, guards, ui, services } = vi.hoisted(() => {
  const deferred = (): { promise: Promise<void>; resolve: () => void } => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    return { promise, resolve: () => resolve() };
  };
  return {
    deferred,
    lifecycle: { config: deferred(), auth: deferred() },
    guards: {
      page: "test",
      result: false,
      active: true,
      quickRestart: false,
      dev: true,
      cookiesAccepted: true,
    },
    ui: {
      applyFont: vi.fn(async () => undefined),
      hideCaret: vi.fn(),
      showCaret: vi.fn(),
      scrollTape: vi.fn(),
      centerLine: vi.fn(),
      hints: vi.fn(),
      positionInput: vi.fn(),
      focus: vi.fn(),
    },
    services: {
      sync: vi.fn(async () => undefined),
      unregister: vi.fn(),
      cancel: vi.fn(),
      animate: vi.fn(),
      register: vi.fn(async () => ({ scope: "/" })),
    },
  };
});
vi.mock("../../../src/app/readiness", () => ({
  preferencesReadiness: () => ({ wait: async () => lifecycle.config.promise }),
}));
vi.mock("../../../src/ts/auth-client", () => ({
  observeAuthSession: () => () => undefined,
  oauthRequestEvent: { subscribe: () => () => undefined },
  get authPromise() {
    return lifecycle.auth.promise;
  },
}));
vi.mock("../../../src/ts/config/store", () => ({
  getMutableConfig: (() => {
    const storedConfig = {
      mode: "words",
      words: 10,
      time: 15,
      tapeMode: "off",
    };
    return () => storedConfig;
  })(),
}));
vi.mock("../../../src/ts/cookies", () => ({
  getAcceptedCookies: () => (guards.cookiesAccepted ? {} : null),
}));
vi.mock("../../../src/ts/states/core", async () => {
  const { createSignal } = await import("solid-js");
  const [getGlobalOffsetTop, setGlobalOffsetTop] = createSignal(0);
  const [getIsScreenshotting, setIsScreenshotting] = createSignal(false);
  return {
    getIsScreenshotting,
    setIsScreenshotting,
    getGlobalOffsetTop,
    setGlobalOffsetTop,
    getActivePage: () => guards.page,
    getCustomTextIndicator: () => undefined,
  };
});
vi.mock("../../../src/ts/states/test", () => ({
  getResultVisible: () => guards.result,
  isTestActive: () => guards.active,
}));
vi.mock("../../../src/ts/test/caret", () => ({
  hide: ui.hideCaret,
  show: ui.showCaret,
}));
vi.mock("../../../src/ts/test/custom-text", () => ({ getData: () => ({}) }));
vi.mock("../../../src/ts/test/test-ui", () => ({
  scrollTape: ui.scrollTape,
  centerActiveLine: ui.centerLine,
  updateHintsPositionDebounced: ui.hints,
  updateWordsInputPosition: ui.positionInput,
  focusWords: ui.focus,
}));
vi.mock("../../../src/app/fonts.client", () => ({
  applyFontFamily: ui.applyFont,
}));
vi.mock("../../../src/ts/utils/dom-ready", () => ({
  onDOMReady: (callback: () => void) => callback(),
}));
vi.mock("../../../src/ts/utils/env", () => ({
  isDevEnvironment: () => guards.dev,
}));
vi.mock("../../../src/ts/utils/misc", () => ({
  applyReducedMotion: (value: number) => value,
}));
vi.mock("../../../src/ts/utils/numbers", () => ({
  convertRemToPixels: (value: number) => value * 16,
}));
vi.mock("../../../src/ts/utils/quick-restart", () => ({
  canQuickRestart: () => guards.quickRestart,
}));
vi.mock("../../../src/ts/ape/server-configuration", () => ({
  sync: services.sync,
}));
vi.mock("../../../src/ts/components/core/GlobalEvents", () => ({
  GlobalEvents: () => null,
}));
vi.mock("animejs", () => ({
  animate: (...args: unknown[]) => {
    services.animate(...args);
    return { cancel: services.cancel };
  },
}));

import { AppEffects } from "../../../src/ts/components/core/AppEffects";
import { configEvent } from "../../../src/ts/events/config";
import {
  setAppLoading,
  setFontFace,
  setFontFamily,
  setFocusCursorHidden,
  setMediaQueryDebugLevel,
} from "../../../src/ts/states/app";
import {
  setGlobalOffsetTop,
  setIsScreenshotting,
} from "../../../src/ts/states/core";
import {
  setCrt,
  setFunboxBodyClasses,
  setFunboxReducedMotionIgnored,
} from "../../../src/ts/states/funbox";
import {
  hideModalAndClearChain,
  isModalOpen,
  showModal,
} from "../../../src/ts/states/modals";

let element: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  lifecycle.config = deferred();
  lifecycle.auth = deferred();
  Object.assign(guards, {
    page: "test",
    result: false,
    active: true,
    quickRestart: false,
    dev: true,
    cookiesAccepted: true,
  });
  setCrt(null);
  setFunboxBodyClasses([]);
  setFunboxReducedMotionIgnored(false);
  setAppLoading(true);
  setFocusCursorHidden(false);
  setFontFace("");
  setFontFamily(undefined);
  setMediaQueryDebugLevel(0);
  setGlobalOffsetTop(0);
  setIsScreenshotting(false);
  element = document.createElement("div");
  element.className = "content-grid focus hidden";
  element.innerHTML = "<input />";
  document.body.className = "legacy crt";
  document.body.append(element);
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistrations: async () => [{ unregister: services.unregister }],
      register: services.register,
    },
  });
});
afterEach(() => {
  cleanup();
  hideModalAndClearChain("GoogleSignup");
  hideModalAndClearChain("Cookies");
  element.remove();
  document.body.className = "";
  document.body.style.removeProperty("transition");
  document.documentElement.style.removeProperty("--font");
  document.documentElement.style.removeProperty("scroll-behavior");
  Reflect.deleteProperty(navigator, "serviceWorker");
  vi.useRealTimers();
});
function mount(): ReturnType<typeof render> {
  return render(() => (
    <>
      <FontRuntime />
      <AppEffects
        element={element}
        body={document.body as HTMLBodyElement}
        noCssWarning={null}
      />
    </>
  ));
}

async function ready(): Promise<void> {
  lifecycle.config.resolve();
  lifecycle.auth.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("App effects", () => {
  it("keeps startup feedback until config and the first page are ready", async () => {
    const startup = document.createElement("div");
    startup.id = "startupScreen";
    document.body.prepend(startup);
    mount();
    expect(startup.isConnected).toBe(true);
    expect(element.querySelector("input")).not.toBeNull();
    await ready();
    expect(startup.isConnected).toBe(true);
    expect(services.animate).not.toHaveBeenCalledWith(
      startup,
      expect.anything(),
    );
    setAppLoading(false);
    expect(services.animate).toHaveBeenLastCalledWith(
      startup,
      expect.objectContaining({ opacity: [1, 0], duration: 150 }),
    );
    expect(startup.isConnected).toBe(true);
    expect(startup.style.pointerEvents).toBe("none");
    const options = services.animate.mock.lastCall?.[1] as {
      onComplete: () => void;
    };
    options.onComplete();
    expect(startup.isConnected).toBe(false);
  });

  it("retains startup feedback when navigation finishes before config", async () => {
    const startup = document.createElement("div");
    startup.id = "startupScreen";
    document.body.prepend(startup);
    mount();
    setAppLoading(false);
    expect(startup.isConnected).toBe(true);
    expect(services.animate).not.toHaveBeenCalled();
    await ready();
    expect(services.animate).toHaveBeenCalledWith(
      startup,
      expect.objectContaining({ opacity: [1, 0] }),
    );
  });

  it("cleans up a pending startup screen when its owner is disposed", async () => {
    const startup = document.createElement("div");
    startup.id = "startupScreen";
    document.body.prepend(startup);
    const { unmount } = mount();
    unmount();
    expect(startup.isConnected).toBe(false);
    await ready();
    setAppLoading(false);
    expect(services.animate).not.toHaveBeenCalled();
  });

  it("reveals signup when startup needs the user's onboarding input", async () => {
    const startup = document.createElement("div");
    startup.id = "startupScreen";
    document.body.prepend(startup);
    mount();
    await ready();
    showModal("GoogleSignup");
    expect(services.animate).toHaveBeenLastCalledWith(
      startup,
      expect.objectContaining({ opacity: [1, 0] }),
    );
    const calls = services.animate.mock.calls.length;
    hideModalAndClearChain("GoogleSignup");
    setAppLoading(false);
    expect(services.animate).toHaveBeenCalledTimes(calls);
  });

  it("opens cookie consent only after the startup fade completes", async () => {
    guards.cookiesAccepted = false;
    const startup = document.createElement("div");
    startup.id = "startupScreen";
    document.body.prepend(startup);
    mount();
    await ready();
    setAppLoading(false);
    expect(isModalOpen("Cookies")).toBe(false);
    const options = services.animate.mock.lastCall?.[1] as {
      onComplete: () => void;
    };
    options.onComplete();
    expect(startup.isConnected).toBe(false);
    expect(isModalOpen("Cookies")).toBe(true);
  });
  it("hides owned fallbacks during screenshots and stops reacting on disposal", () => {
    const noscript = document.createElement("noscript");
    noscript.className = "fallback";
    document.body.append(noscript);
    const warning = document.createElement("div");
    warning.className = "warning";
    const { unmount } = render(() => (
      <AppEffects
        element={element}
        body={document.body as HTMLBodyElement}
        noCssWarning={warning}
      />
    ));
    setIsScreenshotting(true);
    expect(noscript).toHaveClass("fallback", "hidden");
    expect(warning).toHaveClass("warning", "hidden");
    expect(document.documentElement.style.scrollBehavior).toBe("auto");
    setIsScreenshotting(false);
    expect(noscript).not.toHaveClass("hidden");
    expect(warning).not.toHaveClass("hidden");
    expect(document.documentElement.style.scrollBehavior).toBe("smooth");
    unmount();
    setIsScreenshotting(true);
    expect(warning).not.toHaveClass("hidden");
    noscript.remove();
  });

  it("reveals the loading shell while authentication is still pending", async () => {
    mount();
    expect(element).toHaveClass("hidden", "focus");
    expect(element.querySelector("input")).not.toBeNull();
    expect(services.animate).not.toHaveBeenCalled();
    expect(services.sync).toHaveBeenCalledOnce();
    lifecycle.config.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await waitFor(() => expect(element).not.toHaveClass("hidden"));
    expect(document.body.style.transition).toBe(
      "background .25s, transform .05s",
    );
    expect(services.animate).toHaveBeenCalledWith(element, {
      opacity: [0, 1],
      duration: 250,
    });
    expect(services.sync).toHaveBeenCalledOnce();
    expect(services.unregister).toHaveBeenCalledOnce();
  });

  it("registers the service worker when startup finishes after window load", async () => {
    guards.dev = false;
    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
    mount();
    await ready();
    expect(services.register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    vi.restoreAllMocks();
  });

  it("binds owned classes, padding and fonts while preserving legacy changes", () => {
    mount();
    expect(document.body).toHaveClass("loading", "crt");
    document.body.className += " extra-funbox";
    setMediaQueryDebugLevel(2);
    setAppLoading(false);
    setFocusCursorHidden(true);
    setFunboxBodyClasses(["fb-read-ahead"]);
    setCrt({});
    setFunboxReducedMotionIgnored(true);
    expect(document.body).toHaveClass(
      "fb-read-ahead",
      "crtmode",
      "ignore-reduced-motion",
      "extra-funbox",
    );
    setFunboxBodyClasses([]);
    setCrt(null);
    expect(document.body).not.toHaveClass("fb-read-ahead", "crtmode");
    expect(document.body).toHaveClass("ignore-reduced-motion", "extra-funbox");
    expect(
      document.body.className
        .split(/\s+/)
        .filter((name) => name === "ignore-reduced-motion"),
    ).toHaveLength(1);
    setGlobalOffsetTop(40);
    setFontFamily('"LOCALCUSTOM",monospace');
    setFontFace("@font-face { font-family: LOCALCUSTOM; }");
    expect(document.body).toHaveClass(
      "legacy",
      "crt",
      "extra-funbox",
      "mediaQueryDebugLevel2",
    );
    expect(document.body).not.toHaveClass("loading");
    expect(document.body).toHaveClass(
      "cursor-none",
      "[&_button]:cursor-none!",
      "[&_a]:cursor-none!",
    );
    setFocusCursorHidden(false);
    expect(document.body).not.toHaveClass("cursor-none");
    expect(element.style.paddingTop).toBe("72px");
    expect(document.documentElement.style.getPropertyValue("--font")).toBe(
      '"LOCALCUSTOM",monospace',
    );
    expect(document.head.querySelector(".customFont")?.textContent).toContain(
      "LOCALCUSTOM",
    );
    setMediaQueryDebugLevel(0);
    expect(document.body).not.toHaveClass("mediaQueryDebugLevel2");
  });

  it("guards active tests on unload and cancels resize work on disposal", () => {
    vi.useFakeTimers();
    const { unmount } = mount();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    guards.quickRestart = true;
    const quickUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(quickUnload);
    expect(quickUnload.defaultPrevented).toBe(false);
    window.dispatchEvent(new Event("resize"));
    expect(ui.hideCaret).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(250);
    expect(ui.centerLine).toHaveBeenCalledOnce();
    unmount();
    vi.advanceTimersByTime(1000);
    expect(ui.positionInput).not.toHaveBeenCalled();
    expect(ui.showCaret).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("resize"));
    expect(ui.hideCaret).toHaveBeenCalledOnce();
  });

  it("removes config listeners and ignores startup after disposal", async () => {
    const { unmount } = mount();
    expect(ui.applyFont).toHaveBeenCalledOnce();
    configEvent.dispatch({
      key: "language",
      newValue: "english",
      previousValue: "english",
    });
    expect(ui.applyFont).toHaveBeenCalledTimes(2);
    unmount();
    configEvent.dispatch({
      key: "language",
      newValue: "english",
      previousValue: "english",
    });
    expect(ui.applyFont).toHaveBeenCalledTimes(2);
    await ready();
    expect(services.animate).not.toHaveBeenCalled();
    expect(services.sync).toHaveBeenCalledOnce();
  });
});
