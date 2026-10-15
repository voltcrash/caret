import { writeFile } from "node:fs/promises";
import { expect, openTest, test } from "./fixtures";

test("render 1,000 words with browser layout", async ({ page }) => {
  await openTest(page);
  const measurements = await page.evaluate(async () => {
    const renderingUrl = "/ts/components/pages/test/words/rendering.ts";
    const wordsUrl = "/ts/test/test-words.ts";
    const { showWords, updateWordLetters } = (await import(
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
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    const typing: number[] = [];
    const originalRequest = window.requestAnimationFrame;
    const originalCancel = window.cancelAnimationFrame;
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    window.requestAnimationFrame = (callback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    };
    window.cancelAnimationFrame = (id) => {
      frames.delete(id);
    };
    try {
      for (let sample = 0; sample < 60; sample++) {
        const start = performance.now();
        for (let update = 0; update < 100; update++) {
          await updateWordLetters({
            wordIndex: 0,
            input: "rendering000".slice(0, (update % 12) + 1),
            compositionData: "",
          });
          const callbacks = Array.from(frames.values());
          frames.clear();
          for (const callback of callbacks) callback(performance.now());
        }
        if (sample >= 10) typing.push((performance.now() - start) / 100);
      }
    } finally {
      window.requestAnimationFrame = originalRequest;
      window.cancelAnimationFrame = originalCancel;
    }
    return {
      words: words.length,
      letters: 12_000,
      samples: 50,
      dom: summarize(dom),
      layout: summarize(layout),
      typing: summarize(typing),
      raw: { dom, layout, typing },
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
