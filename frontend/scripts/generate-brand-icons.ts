/**
 * Regenerates static brand assets from the shared mark geometry.
 * vpx ./scripts/generate-brand-icons.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

import {
  caretBrandColors,
  caretIconSvg,
  caretMarkPath,
  caretMarkViewBox,
} from "../src/components/brand/caret-icon";

const statics = new URL("../static/", import.meta.url);
const out = (path: string): URL => new URL(path, statics);

const square = { radius: 0, scale: 0.68 };
const maskable = { radius: 0, scale: 0.6 };
const pngs: { file: string; size: number; svg: string }[] = [
  {
    file: "images/icons/caret-180.png",
    size: 180,
    svg: caretIconSvg(undefined, square),
  },
  { file: "images/icons/caret-192.png", size: 192, svg: caretIconSvg() },
  { file: "images/icons/caret-512.png", size: 512, svg: caretIconSvg() },
  {
    file: "images/icons/caret-maskable-192.png",
    size: 192,
    svg: caretIconSvg(undefined, maskable),
  },
  {
    file: "images/icons/caret-maskable-512.png",
    size: 512,
    svg: caretIconSvg(undefined, maskable),
  },
];

const lexend = readFileSync(out("webfonts/LexendDeca-Regular.woff2")).toString(
  "base64",
);
const socialCard = `<!doctype html>
<style>
  @font-face { font-family: Lexend; src: url(data:font/woff2;base64,${lexend}); }
  body { margin: 0; width: 1200px; height: 630px; display: grid; place-items: center;
    background: ${caretBrandColors.bg}; font-family: Lexend; }
  main { display: flex; align-items: center; gap: 56px; }
  svg { width: 200px; height: 200px; fill: ${caretBrandColors.main}; }
  h1 { margin: 0; font-weight: 400; font-size: 136px; line-height: 1; color: #d1d0c5; }
  p { margin: 18px 0 0 6px; font-size: 34px; color: #646669; }
</style>
<main>
  <svg viewBox="${caretMarkViewBox}"><path d="${caretMarkPath}"/></svg>
  <div><h1>caret</h1><p>a minimalistic, customizable typing test</p></div>
</main>`;

async function main(): Promise<void> {
  writeFileSync(out("images/favicon/caret.svg"), `${caretIconSvg()}\n`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const { file, size, svg } of pngs) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(
        `<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`,
      );
      await page.screenshot({ path: out(file).pathname, omitBackground: true });
    }
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.setContent(socialCard);
    // Crop the mark to its ink so the wordmark spacing follows its shape.
    await page.evaluate(() => {
      const svg = document.querySelector("svg");
      const box = svg?.getBBox();
      if (svg === null || box === undefined) return;
      svg.setAttribute(
        "viewBox",
        `${box.x} ${box.y} ${box.width} ${box.height}`,
      );
      svg.style.width = `${(box.width / box.height) * 200}px`;
    });
    await page.evaluate(async () => document.fonts.ready);
    await page.screenshot({ path: out("images/og/caret.png").pathname });
  } finally {
    await browser.close();
  }
}

void main();
