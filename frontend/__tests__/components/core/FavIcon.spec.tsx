import { MetaProvider } from "@solidjs/meta";
import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type { Theme } from "../../../src/ts/constants/themes";

import { caretMarkPath } from "../../../src/components/brand/caret-icon";
import { FavIcon } from "../../../src/ts/components/core/FavIcon";

const { isDevEnvironment } = vi.hoisted(() => ({
  isDevEnvironment: vi.fn(() => false),
}));
vi.mock("../../../src/ts/utils/env", () => ({ isDevEnvironment }));

function renderIcon(bg: string, main: string): void {
  render(() => (
    <MetaProvider>
      <FavIcon theme={{ bg, main } as Theme} />
    </MetaProvider>
  ));
}

function iconSvg(): string {
  const href = document.head
    .querySelector<HTMLLinkElement>("link#favicon")
    ?.getAttribute("href");
  if (href === null || href === undefined) throw new Error("No favicon");
  return atob(href.replace("data:image/svg+xml;base64,", ""));
}

describe("FavIcon", () => {
  afterEach(() => {
    cleanup();
    isDevEnvironment.mockReturnValue(false);
  });

  it("draws the oxytype mark in theme colors", () => {
    renderIcon("#323437", "#e2b714");
    const svg = iconSvg();
    expect(svg).toContain(caretMarkPath);
    expect(svg).toContain('fill="#323437"');
    expect(svg).toContain('fill="#e2b714"');
  });

  it("swaps colors in development", () => {
    isDevEnvironment.mockReturnValue(true);
    renderIcon("#323437", "#e2b714");
    expect(iconSvg()).toMatch(/<rect[^>]*fill="#e2b714"/);
  });

  it("falls back to contrasting colors when main matches bg", () => {
    renderIcon("#000", "#000");
    const svg = iconSvg();
    expect(svg).toContain('fill="#111"');
    expect(svg).toContain('fill="#eee"');
  });
});
