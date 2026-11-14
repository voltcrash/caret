import { expect, test } from "./fixtures";

test.use({ serviceWorkers: "block" });

for (const connection of [
  { effectiveType: "3g", saveData: false },
  { effectiveType: "4g", saveData: true },
]) {
  test(`constrained connection ${JSON.stringify(connection)} skips hover downloads but allows navigation`, async ({
    page,
  }) => {
    await page.addInitScript((connection) => {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: Object.assign(new EventTarget(), connection),
      });
    }, connection);
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto("/");
    await expect(page.locator("#words .word").first()).toBeVisible();
    const settings = page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Settings", exact: true });
    await settings.hover();
    // Router's intent delay is 50 ms. Observe a full second for unwanted work.
    await page.waitForTimeout(1000);
    expect(
      requests.filter((url) => /\/_app.settings[^/]*\.js/.test(url)),
    ).toEqual([]);
    await settings.click();
    await expect(
      page.getByRole("textbox", { name: "Search settings" }),
    ).toBeVisible();
    expect(requests.some((url) => /\/_app.settings[^/]*\.js/.test(url))).toBe(
      true,
    );
  });
}

for (const degraded of [
  { effectiveType: "3g", saveData: false },
  { effectiveType: "4g", saveData: true },
]) {
  test(`connection changes update intent prefetch: ${JSON.stringify(degraded)}`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: Object.assign(new EventTarget(), {
          effectiveType: "4g",
          saveData: false,
        }),
      });
    });
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto("/");
    await expect(page.locator("#words .word").first()).toBeVisible();
    await page.evaluate((degraded) => {
      const connection = (navigator as Navigator & { connection: EventTarget })
        .connection;
      Object.assign(connection, degraded);
      connection.dispatchEvent(new Event("change"));
    }, degraded);
    const settings = page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Settings", exact: true });
    await settings.hover();
    await page.waitForTimeout(1000);
    expect(
      requests.filter((url) => /\/_app.settings[^/]*\.js/.test(url)),
    ).toEqual([]);
    await page.mouse.move(0, 0);
    await page.evaluate(() => {
      const connection = (navigator as Navigator & { connection: EventTarget })
        .connection;
      Object.assign(connection, { effectiveType: "4g", saveData: false });
      connection.dispatchEvent(new Event("change"));
    });
    await settings.hover();
    await expect
      .poll(() => requests.some((url) => /\/_app.settings[^/]*\.js/.test(url)))
      .toBe(true);
  });
}
