import { describe, expect, it } from "vite-plus/test";

import { scrollRowIntoView } from "../../../../src/ts/components/modals/event-log-viewer/scroll-row";

function rect(top: number, bottom: number): DOMRect {
  return { top, bottom, height: bottom - top } as DOMRect;
}

function setup(
  rowTop: number,
  rowBottom: number,
  headHeight = 20,
): HTMLDivElement {
  const container = document.createElement("div");
  container.innerHTML = `<table><thead></thead><tbody><tr data-row="3"></tr></tbody></table>`;
  container.getBoundingClientRect = () => rect(100, 300);
  const head = container.querySelector("thead") as HTMLElement;
  head.getBoundingClientRect = () => rect(100, 100 + headHeight);
  const row = container.querySelector('[data-row="3"]') as HTMLElement;
  row.getBoundingClientRect = () => rect(rowTop, rowBottom);
  container.scrollTop = 500;
  return container;
}

describe("scrollRowIntoView", () => {
  it("scrolls up so the row clears the sticky head", () => {
    const container = setup(90, 110);
    scrollRowIntoView(container, 3);
    // row top needs to sit at 120 (container top + head), so up by 30
    expect(container.scrollTop).toBe(470);
  });

  it("scrolls down so the row bottom is visible", () => {
    const container = setup(290, 320);
    scrollRowIntoView(container, 3);
    expect(container.scrollTop).toBe(520);
  });

  it("leaves a visible row alone", () => {
    const container = setup(150, 170);
    scrollRowIntoView(container, 3);
    expect(container.scrollTop).toBe(500);
  });

  it("ignores missing containers, rows and negative indices", () => {
    const container = setup(90, 110);
    expect(() => scrollRowIntoView(undefined, 3)).not.toThrow();
    scrollRowIntoView(container, -1);
    scrollRowIntoView(container, 7);
    expect(container.scrollTop).toBe(500);
  });
});
