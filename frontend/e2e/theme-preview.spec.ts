import type { Locator } from "playwright/test";

import { expect, openTest, test } from "./fixtures";

test.use({ config: { theme: "serika", randomTheme: "off" } });

for (const picker of ["settings", "switcher"] as const) {
  test(`${picker} previews decorations without requests or saving hover colors`, async ({
    page,
  }) => {
    const themeRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/themes\/.*\.css/.test(request.url())) {
        themeRequests.push(request.url());
      }
    });
    await openTest(page);
    const indicator = page.locator('[data-ui-element="themeIndicator"]');
    await expect(indicator).toHaveText("serika");
    if (picker === "settings") {
      await page.goto("/settings?tab=theme");
      await expect(
        page.getByRole("button", { name: "Apply theme phantom", exact: true }),
      ).toBeVisible();
    } else {
      await indicator.click();
      await expect(page.locator("#commandLine")).toBeVisible();
    }
    const saved = await page.evaluate(() =>
      localStorage.getItem("themeColors"),
    );
    const option = (name: string): Locator =>
      picker === "settings"
        ? page.getByRole("button", { name: `Apply theme ${name}`, exact: true })
        : page.locator(
            `[data-command-id="changeTheme${name[0]?.toUpperCase()}${name.slice(1)}"]`,
          );
    for (const name of ["phantom", "matrix", "aether", "phantom"]) {
      await option(name).hover();
      await expect(indicator).toHaveText(name);
      const decoration = expect.poll(async () =>
        page.locator("style#currentTheme").textContent(),
      );
      if (name === "matrix") {
        await decoration.toBe("");
      } else {
        await decoration.toContain(
          name === "phantom" ? "phantom-glow" : "data-nav-item",
        );
      }
    }
    expect(themeRequests).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem("themeColors"))).toBe(
      saved,
    );
    await page.screenshot({
      path: test.info().outputPath(`theme-preview-${picker}.png`),
    });

    if (picker === "settings") {
      await page.mouse.move(0, 0);
    } else {
      await page.keyboard.press("Escape");
    }
    await expect(indicator).toHaveText("serika");
    await expect
      .poll(async () => page.locator("style#currentTheme").textContent())
      .toBe("");
  });
}
