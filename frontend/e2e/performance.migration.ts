import { writeFile } from "node:fs/promises";
import { devices, expect, test } from "playwright/test";

const profiles = [
  { name: "desktop", cpu: 1, latency: 0, download: -1 },
  { name: "mobile-4g", cpu: 4, latency: 150, download: 200 * 1024 },
  { name: "mobile-3g", cpu: 6, latency: 400, download: 50 * 1024 },
] as const;

test("cold startup across CPU, viewport and network conditions", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const output = process.env["CARET_PERFORMANCE_OUTPUT"];
  if (output === undefined) throw new Error("Set CARET_PERFORMANCE_OUTPUT");
  const measurements = [];
  for (const profile of profiles) {
    const samples = [];
    for (let sample = 0; sample < 3; sample++) {
      const context = await browser.newContext({
        ...(profile.cpu === 1 ? devices["Desktop Chrome"] : devices["Pixel 7"]),
        baseURL,
        serviceWorkers: "block",
      });
      try {
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
        await cdp.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: profile.latency,
          downloadThroughput: profile.download,
          uploadThroughput: profile.download,
        });
        await page.addInitScript(() => {
          localStorage.setItem(
            "acceptedCookies",
            JSON.stringify({
              security: false,
              analytics: false,
              sentry: false,
            }),
          );
          localStorage.setItem(
            "config",
            JSON.stringify({ mode: "words", words: 15 }),
          );
          const observer = new MutationObserver(() => {
            if (
              document.querySelector("#words .word") !== null &&
              document.getElementById("startupScreen") === null
            ) {
              performance.mark("oxytype-ready");
              observer.disconnect();
            }
          });
          observer.observe(document, { subtree: true, childList: true });
        });
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await expect(page.locator("#startupScreen")).toHaveCount(0, {
          timeout: 60_000,
        });
        const word = page.locator("#words .word").first();
        await expect(word).toBeVisible();
        const metrics = await page.evaluate(() => {
          const scripts = performance
            .getEntriesByType("resource")
            .filter((entry) =>
              entry.name.endsWith(".js"),
            ) as PerformanceResourceTiming[];
          return {
            readyMs:
              performance.getEntriesByName("oxytype-ready")[0]?.startTime,
            jsRequests: scripts.length,
            jsBytes: scripts.reduce(
              (total, entry) => total + entry.decodedBodySize,
              0,
            ),
          };
        });
        expect(metrics.readyMs).toBeGreaterThan(0);
        await word.click();
        const first = (await word.textContent())?.[0];
        if (first === undefined) throw new Error("Missing word");
        await page.keyboard.type(first);
        await expect(word.locator("letter.correct")).toHaveCount(1);
        samples.push(metrics);
      } finally {
        await context.close();
      }
    }
    measurements.push({ ...profile, samples });
  }
  await writeFile(
    output,
    `${JSON.stringify({ fixture: "Start Worker; guest; cold HTTP cache; service workers blocked; three fresh contexts per profile", measurements }, null, 2)}\n`,
  );
});
