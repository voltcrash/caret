import budgets from "../../docs/rust-engine/performance-budgets.json" with { type: "json" };
import { summarize } from "../scripts/migration-performance";
import { writeFile } from "node:fs/promises";
import { expect, test } from "playwright/test";

// Same built Worker fixture as the website regressions. Freeze before porting.
test("typing engine baseline: input paint, restart, retained heap", async ({
  page,
  context,
}) => {
  const output = process.env["ENGINE_PERFORMANCE_OUTPUT"];
  if (output === undefined) throw new Error("Set ENGINE_PERFORMANCE_OUTPUT");
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "acceptedCookies",
      JSON.stringify({ security: false, analytics: false, sentry: false }),
    );
    localStorage.setItem(
      "config",
      JSON.stringify({ mode: "zen", smoothCaret: "off", quickRestart: "off" }),
    );
  });
  await page.goto("/");
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
  await page.locator("#words").click();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("HeapProfiler.collectGarbage");
  const wasmMemory = async (): Promise<number> =>
    page.evaluate(() =>
      (
        window as unknown as { engineMigrationMemory: () => number }
      ).engineMigrationMemory(),
    );
  const initialWasm = await wasmMemory();
  const initialHeap = (await cdp.send("Runtime.getHeapUsage")).usedSize;
  const inputToPaint: number[] = [];
  const restart: number[] = [];
  for (let sample = 0; sample < 20; sample++) {
    // Capture host beforeinput time; include rendering through the next frame.
    await page.evaluate(() => {
      const input = document.querySelector<HTMLTextAreaElement>("#wordsInput");
      if (input === null) throw new Error("Missing input");
      input.addEventListener(
        "beforeinput",
        () => performance.mark("engine-input"),
        { once: true },
      );
    });
    await page.keyboard.type("a");
    await expect(page.locator("#wordsInput")).toHaveValue(" a");
    inputToPaint.push(
      await page.evaluate(async () => {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        return (
          performance.now() -
          (performance.getEntriesByName("engine-input").at(-1)?.startTime ??
            performance.now())
        );
      }),
    );
    const start = performance.now();
    await page.locator("#restartTestButton").click();
    await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
    await expect(page.locator("#wordsInput")).toHaveValue(" ");
    restart.push(performance.now() - start);
    await page.locator("#words").click();
  }
  // Real keyboard observations; no engine-internal shortcut for the long run.
  await page.keyboard.type("a ".repeat(1000));
  await expect(page.locator("#words .word.active")).toHaveAttribute(
    "data-wordindex",
    "1000",
  );
  await cdp.send("HeapProfiler.collectGarbage");
  const activeWasm = await wasmMemory();
  const activeHeap = (await cdp.send("Runtime.getHeapUsage")).usedSize;
  await page.locator("#restartTestButton").click();
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
  await cdp.send("HeapProfiler.collectGarbage");
  const resetWasm = await wasmMemory();
  const resetHeap = (await cdp.send("Runtime.getHeapUsage")).usedSize;
  const assets = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((entry) => /\.(js|wasm)(\?|$)/.test(entry.name))
      .map((entry) => {
        const resource = entry as PerformanceResourceTiming;
        return {
          name: new URL(resource.name).pathname,
          bytes: resource.decodedBodySize,
          transfer: resource.transferSize,
        };
      }),
  );
  await writeFile(
    output,
    `${JSON.stringify({ browser: context.browser()?.version(), fixture: "built Start Worker; desktop Chromium; zen; 20 input/restart samples; double-rAF paint; 2000 keyboard characters; forced GC", inputToPaint, restart, initialHeap, activeHeap, resetHeap, initialWasm, activeWasm, resetWasm, assets, errors }, null, 2)}\n`,
  );
  expect(errors).toEqual([]);
  if (process.env["ENGINE_ENFORCE_PERFORMANCE"] === "true") {
    expect(summarize(inputToPaint).p95).toBeLessThanOrEqual(
      budgets.inputToPaintP95Ms,
    );
    expect(summarize(restart).median).toBeLessThanOrEqual(
      budgets.restartMedianMs,
    );
    expect(summarize(restart).p95).toBeLessThanOrEqual(budgets.restartP95Ms);
    expect(activeHeap).toBeLessThanOrEqual(budgets.activeHeapBytes);
    expect(resetHeap).toBeLessThanOrEqual(budgets.resetHeapBytes);
    expect(resetWasm).toBeLessThanOrEqual(budgets.wasmHeapBytesAfterReset);
  }
});

test("repeated website zen sessions keep bounded reset heaps", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => {
    localStorage.setItem(
      "acceptedCookies",
      JSON.stringify({ security: false, analytics: false, sentry: false }),
    );
    localStorage.setItem(
      "config",
      JSON.stringify({ mode: "zen", smoothCaret: "off", quickRestart: "off" }),
    );
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  await page.goto("/");
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
  const cdp = await context.newCDPSession(page);
  const samples = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.locator("#words").click();
    await page.keyboard.type("a ".repeat(1000));
    await expect(page.locator("#words .word.active")).toHaveAttribute(
      "data-wordindex",
      "1000",
    );
    await page.locator("#restartTestButton").click();
    await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
    await expect(page.locator("#wordsInput")).toHaveValue(" ");
    await cdp.send("HeapProfiler.collectGarbage");
    samples.push({
      heap: (await cdp.send("Runtime.getHeapUsage")).usedSize,
      wasm: await page.evaluate(() =>
        (
          window as unknown as { engineMigrationMemory: () => number }
        ).engineMigrationMemory(),
      ),
    });
  }
  const output = process.env["ENGINE_WEBSITE_SOAK_OUTPUT"];
  if (output !== undefined) {
    await writeFile(
      output,
      `${JSON.stringify({ fixture: "3 real-keyboard 2000-unit zen sessions; restart and forced GC", samples, errors }, null, 2)}\n`,
    );
  }
  expect(errors).toEqual([]);
  if (process.env["ENGINE_ENFORCE_PERFORMANCE"] === "true") {
    expect(
      Math.max(...samples.map((sample) => sample.wasm)),
    ).toBeLessThanOrEqual(budgets.wasmHeapBytesAfterReset);
    expect(
      Math.max(...samples.map((sample) => sample.heap)),
    ).toBeLessThanOrEqual(budgets.resetHeapBytes);
  }
});
