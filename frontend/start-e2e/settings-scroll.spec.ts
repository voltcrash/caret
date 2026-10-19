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
