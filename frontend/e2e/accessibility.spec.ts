import { AxeBuilder } from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page, TestInfo } from "playwright/test";
import { completeWords, expect, openTest, test } from "./fixtures";

async function checkAccessibility(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  await expect(page.locator("#startupScreen")).toHaveCount(0);
  await expect(page.locator("#app")).toHaveCSS("opacity", "1");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const results = await new AxeBuilder({ page }).analyze();
  const directory = process.env["AXE_RESULTS_DIRECTORY"];
  if (directory !== undefined) {
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, `${testInfo.title.replace(/\W/g, "-")}.json`),
      JSON.stringify(results),
    );
  }
  await testInfo.attach("axe-results", {
    body: JSON.stringify(results),
    contentType: "application/json",
  });
  const violations = results.violations
    .filter(({ impact }) => impact === "serious" || impact === "critical")
    .map(({ id, impact, nodes }) => ({
      id,
      impact,
      nodes: nodes.map(({ target, failureSummary }) => ({
        target,
        failureSummary,
      })),
    }));
  expect(violations).toEqual([]);
}

test("test page has no serious or critical axe violations", async ({
  page,
}, testInfo) => {
  await openTest(page);
  await checkAccessibility(page, testInfo);
});

test("result screen has no serious or critical axe violations", async ({
  page,
}, testInfo) => {
  await openTest(page);
  await completeWords(page);
  await expect(page.locator("#result")).toHaveCSS("opacity", "1");
  await checkAccessibility(page, testInfo);
});
