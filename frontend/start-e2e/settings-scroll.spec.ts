import type { Page } from "playwright/test";

import { expect, test } from "./fixtures";

const guestSections = [
  "behavior",
  "input",
  "sound",
  "caret",
  "appearance",
  "theme",
  "hideElements",
  "dangerZone",
];

async function scrollThroughSettings(
  page: Page,
  sections: string[] = guestSections,
): Promise<void> {
  const scroller = page.locator('[data-scroll-restoration-id="page-content"]');
  const headings = page.locator("[data-settings-section] > h2");
  await expect(headings).toHaveCount(sections.length);
  const seen = new Set<string>();
  // Half-screen increments ensure even short sections pass through the viewport.
  for (let step = 0; step < 100 && seen.size < sections.length; step++) {
    const visible = await headings.evaluateAll((elements) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= window.innerHeight;
        })
        .map((element) => element.parentElement?.dataset["settingsSection"]),
    );
    for (const section of visible) {
      if (section !== undefined) seen.add(section);
    }
    if (seen.size === sections.length) break;
    const before = await scroller.evaluate((element) => element.scrollTop);
    await scroller.evaluate((element) =>
      element.scrollBy({ top: window.innerHeight / 2, behavior: "instant" }),
    );
    await expect
      .poll(async () => scroller.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(before);
  }
  expect([...seen]).toEqual(sections);
  await scroller.evaluate((element) =>
    element.scrollTo({ top: element.scrollHeight, behavior: "instant" }),
  );
  await expect(
    page
      .getByRole("navigation", { name: "Page sections" })
      .getByRole("button", {
        name: "advanced",
        exact: true,
      }),
  ).toHaveAttribute("aria-current", "location");
}

test("desktop settings reach every section by scrolling alone", async ({
  page,
}) => {
  await page.goto("/settings");
  await scrollThroughSettings(page);
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.locator("#group_account")).toHaveCount(0);
});

test("mobile settings reach every section without returning to navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");
  await expect(
    page.getByRole("textbox", { name: "Search settings" }),
  ).toBeInViewport();
  await scrollThroughSettings(page);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("sidebar clicks and hotkeys jump even when the requested tab is unchanged", async ({
  page,
}) => {
  await page.goto("/settings?tab=theme");
  const theme = page.locator("#group_theme h2");
  const input = page.locator("#group_input h2");
  const nav = page.getByRole("navigation", { name: "Page sections" });
  await expect(theme).toBeInViewport();
  await input.evaluate((element) =>
    element.scrollIntoView({ block: "start", behavior: "instant" }),
  );
  await expect(
    nav.getByRole("button", { name: "input", exact: true }),
  ).toHaveAttribute("aria-current", "location");
  await nav.getByRole("button", { name: "theme", exact: true }).click();
  await expect(theme).toBeInViewport();
  await input.evaluate((element) =>
    element.scrollIntoView({ block: "start", behavior: "instant" }),
  );
  await page.keyboard.press("ControlOrMeta+6");
  await expect(theme).toBeInViewport();
  await expect(page).toHaveURL(/\/settings\?tab=theme$/);
});

test("clearing search restores all sections and selecting a result section jumps", async ({
  page,
}) => {
  await page.goto("/settings");
  const search = page.getByRole("textbox", { name: "Search settings" });
  const nav = page.getByRole("navigation", { name: "Page sections" });
  await search.fill("caret");
  await expect(page.locator("#group_behavior")).toBeHidden();
  await expect(page.locator('[data-setting-key="caretStyle"]')).toBeVisible();
  await expect(nav.locator("[aria-current]")).toHaveCount(0);
  await page.getByRole("button", { name: "clear search", exact: true }).click();
  for (const section of guestSections) {
    await expect(page.locator(`#group_${section}`)).toBeVisible();
  }
  await search.fill("caret");
  await nav.getByRole("button", { name: /^theme/ }).click();
  await expect(search).toHaveValue("");
  await expect(page.locator("#group_theme h2")).toBeInViewport();
  await expect(page.locator("#group_behavior")).toBeVisible();
});
