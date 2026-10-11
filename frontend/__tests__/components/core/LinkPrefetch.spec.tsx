import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const { preloadPage, environment } = vi.hoisted(() => ({
  preloadPage: vi.fn(async () => undefined),
  environment: { isDevelopment: false, devPrefetch: false },
}));
vi.mock("virtual:env-config", () => ({ envConfig: environment }));
vi.mock("../../../src/ts/components/pages/lazy-pages", () => ({
  preloadPage,
}));

import { LinkPrefetch } from "../../../src/ts/components/core/LinkPrefetch";

describe("LinkPrefetch", () => {
  afterEach(() => {
    cleanup();
    preloadPage.mockClear();
    environment.isDevelopment = false;
    environment.devPrefetch = false;
  });

  it("preloads the page behind a hovered or focused router link", () => {
    render(() => (
      <>
        <LinkPrefetch />
        <a href="/settings" router-link>
          <span>settings</span>
        </a>
        <a href="/about">about</a>
      </>
    ));
    const [routerLink, plainLink] = document.querySelectorAll("a");

    routerLink
      ?.querySelector("span")
      ?.dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(preloadPage).toHaveBeenCalledWith("settings");

    routerLink?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(preloadPage).toHaveBeenCalledTimes(2);

    plainLink?.dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(preloadPage).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])(
    "makes development prefetch opt-in (%s)",
    (enabled) => {
      environment.isDevelopment = true;
      environment.devPrefetch = enabled;
      render(() => (
        <>
          <LinkPrefetch />
          <a href="/settings" router-link>
            settings
          </a>
        </>
      ));
      document
        .querySelector("a")
        ?.dispatchEvent(new Event("pointerover", { bubbles: true }));
      expect(preloadPage).toHaveBeenCalledTimes(enabled ? 1 : 0);
    },
  );
});
