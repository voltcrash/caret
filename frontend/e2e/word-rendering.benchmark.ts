import { writeFile } from "node:fs/promises";
import { expect, openTest, test } from "./fixtures";

test("render 1,000 words with browser layout", async ({ page }) => {
  await openTest(page);
  const measurements = await page.evaluate(async () => {
    const renderingUrl = "/ts/components/pages/test/words/rendering.ts";
    const wordsUrl = "/ts/test/test-words.ts";
    const { showWords } = (await import(
      /* @vite-ignore */ renderingUrl
    )) as typeof import("../src/ts/components/pages/test/words/rendering");
    const { words } = (await import(
      /* @vite-ignore */ wordsUrl
    )) as typeof import("../src/ts/test/test-words");
    await document.fonts.ready;
    words.reset();
    for (let i = 0; i < 1_000; i++) {
      words.push(`rendering${i.toString(36).padStart(3, "0")} `, 0);
    }
    const container = document.getElementById("words");
    if (container === null) throw new Error("Missing words container");
    const dom: number[] = [];
    const layout: number[] = [];
    for (let sample = 0; sample < 60; sample++) {
      const start = performance.now();
      showWords();
      const domEnd = performance.now();
      // Include synchronous style/layout work, matching visible rendering cost.
      void container.offsetHeight;
      const end = performance.now();
      if (sample >= 10) {
        dom.push(domEnd - start);
        layout.push(end - start);
      }
    }
    const summarize = (samples: number[]): { median: number; p95: number } => {
      samples.sort((a, b) => a - b);
      return { median: samples[25] ?? 0, p95: samples[47] ?? 0 };
    };
    return {
      words: words.length,
      letters: 12_000,
      samples: 50,
      dom: summarize(dom),
      layout: summarize(layout),
    };
  });
  await expect(page.locator("#words .word")).toHaveCount(1_000);
  await expect(page.locator("#words letter")).toHaveCount(12_000);
  const output = process.env["WORD_RENDERING_BENCHMARK_OUTPUT"];
  if (output !== undefined) {
    await writeFile(output, `${JSON.stringify(measurements, null, 2)}\n`);
  }
  console.info(JSON.stringify(measurements));
});
