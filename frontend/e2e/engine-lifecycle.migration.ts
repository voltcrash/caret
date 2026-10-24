import { writeFile } from "node:fs/promises";
import { expect, test } from "playwright/test";
import type { LifecycleProof } from "../src/testing/engine-lifecycle.client";

test("browser Wasm long sessions and repeated ownership release retain bounded work", async ({
  page,
}) => {
  await page.goto("/engine-proof");
  await page
    .getByRole("button", { name: "Run lifecycle", exact: true })
    .click();
  await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty({
    timeout: 90000,
  });
  await expect(page.getByTestId("engine-proof-error")).toBeEmpty();
  const output = JSON.parse(
    await page.getByTestId("engine-proof-result").innerText(),
  ) as LifecycleProof;
  expect(output.invalid).toBe(3);
  expect(output.hostQueries).toEqual({
    compositionReady: true,
    metadata: { allWordsGenerated: false, hasTab: true, hasNewline: true },
    burst: 240,
    canDelete: false,
    timeLimitSeconds: null,
  });
  expect(output.events).toBeGreaterThanOrEqual(20000);
  expect(output.live).toHaveLength(10);
  for (const [index, metrics] of output.live.entries()) {
    expect(metrics.acc).toBe(100);
    expect(metrics.wpm).toBe(1200);
    expect(metrics.chars.correctWord).toBe((index + 1) * 2000);
  }
  expect(output.resetStats.acc).toBe(100);
  expect(output.resetStats.wpm).toBe(0);
  const restarts = output.restarts.slice(10);
  expect(Math.max(...restarts) - Math.min(...restarts)).toBeLessThanOrEqual(
    65536,
  );
  // Timing gates apply only on the recorded machine; CI still checks structural/memory invariants.
  if (process.env["ENGINE_ENFORCE_PERFORMANCE"] === "true") {
    expect(Math.max(...output.costs)).toBeLessThanOrEqual(0.1);
  }
  const path = process.env["ENGINE_LIFECYCLE_OUTPUT"];
  if (path !== undefined) {
    await writeFile(
      path,
      `${JSON.stringify({ browser: page.context().browser()?.version(), fixture: "built Cloudflare Worker; 20000 UTF-16 units; live/minimum rules; 100 owner replacements of 2000 units", ...output }, null, 2)}\n`,
    );
  }
});

test("the frozen 2000-unit reset budget holds through repeated browser sessions", async ({
  page,
}) => {
  await page.goto("/engine-proof");
  await page
    .getByRole("textbox", { name: "Command fixture" })
    .fill(JSON.stringify({ words: 1000 }));
  await page
    .getByRole("button", { name: "Run lifecycle", exact: true })
    .click();
  await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty({
    timeout: 90000,
  });
  await expect(page.getByTestId("engine-proof-error")).toBeEmpty();
  const output = JSON.parse(
    await page.getByTestId("engine-proof-result").innerText(),
  ) as LifecycleProof;
  expect(output.afterReset).toBeLessThanOrEqual(16777216);
  const retained = output.restarts.slice(10);
  expect(Math.max(...retained) - Math.min(...retained)).toBeLessThanOrEqual(
    65536,
  );
  const path = process.env["ENGINE_RESET_OUTPUT"];
  if (path !== undefined) {
    await writeFile(
      path,
      `${JSON.stringify({ browser: page.context().browser()?.version(), fixture: "built Cloudflare Worker; frozen 2000-unit reset workload; 100 replacements", ...output }, null, 2)}\n`,
    );
  }
});

test("initialization reaches usable Wasm across 30 fresh browser contexts", async ({
  browser,
  baseURL,
}) => {
  const samples = [];
  for (let index = 0; index < 30; index++) {
    const context = await browser.newContext({ baseURL });
    try {
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await page.goto("/engine-proof");
      await page
        .getByRole("button", { name: "Run initialization", exact: true })
        .click();
      await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty();
      await expect(page.getByTestId("engine-proof-error")).toBeEmpty();
      samples.push(
        JSON.parse(
          await page.getByTestId("engine-proof-result").innerText(),
        ) as { initializationMs: number; memory: number },
      );
    } finally {
      await context.close();
    }
  }
  const sorted = samples
    .map((sample) => sample.initializationMs)
    .sort((a, b) => a - b);
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
  const path = process.env["ENGINE_INITIALIZATION_OUTPUT"];
  if (path !== undefined) {
    await writeFile(
      path,
      `${JSON.stringify({ browser: browser.version(), fixture: "30 fresh browser contexts; HTTP cache disabled; built Cloudflare Worker; from browser-only import through usable finite session; no CPU/network throttle", samples, p95 }, null, 2)}\n`,
    );
  }
  if (process.env["ENGINE_ENFORCE_PERFORMANCE"] === "true") {
    expect(p95).toBeLessThanOrEqual(100);
  }
});
