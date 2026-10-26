import { assertRestarted, expect, openTest, test } from "./fixtures";

test("background URL saves on blur and Enter without freezing", async ({
  page,
}) => {
  await page.route("**/audit-background-*.png", async (route) => {
    await route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  });
  await openTest(page);
  await page.goto("/settings?highlight=customBackground");
  const input = page
    .locator('[data-setting-key="customBackground"]')
    .getByRole("textbox");
  for (const [index, key] of ["Tab", "Enter"].entries()) {
    const url = new URL(`/audit-background-${index}.png`, page.url()).href;
    await input.fill(url);
    await input.press(key);
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            const config = JSON.parse(
              localStorage.getItem("config") ?? "{}",
            ) as { customBackground?: string };
            return config.customBackground;
          }),
      )
      .toBe(url);
    await expect
      .poll(
        async () =>
          await page
            .locator(".customBackground img")
            .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBe(1);
    await page.reload();
    await expect(input).toHaveValue(url);
  }
  await page.getByRole("link", { name: "Caret Home", exact: true }).click();
  await expect(page.locator("#words .word").first()).toBeVisible();
});

test("animation FPS saves on blur and Enter, persists and returns to native", async ({
  page,
}) => {
  await openTest(page);
  await page.goto("/settings?highlight=animationFpsLimit");
  const setting = page.locator('[data-setting-key="animationFpsLimit"]');
  const input = setting.getByRole("spinbutton");
  for (const [key, value] of [
    ["Tab", 30],
    ["Enter", 60],
  ] as const) {
    await input.fill(String(value));
    await input.press(key);
    await expect
      .poll(
        async () =>
          await page.evaluate(
            () =>
              JSON.parse(localStorage.getItem("fpsLimit") ?? "null") as
                | number
                | null,
          ),
      )
      .toBe(value);
    await page.reload();
    await expect(input).toHaveValue(String(value));
  }
  await input.fill("14");
  await input.press("Enter");
  expect(await page.evaluate(() => localStorage.getItem("fpsLimit"))).toBe(
    "60",
  );
  await setting.getByRole("button", { name: "native", exact: true }).click();
  await expect
    .poll(
      async () => await page.evaluate(() => localStorage.getItem("fpsLimit")),
    )
    .toBe("1000");
  await page.getByRole("link", { name: "Caret Home", exact: true }).click();
  await expect(page.locator("#words .word").first()).toBeVisible();
});

test("settings change persists through reload", async ({ page }) => {
  await openTest(page);
  await page.goto("/settings?highlight=quickRestart");
  const setting = page.locator('[data-setting-key="quickRestart"]');
  await expect(setting).toBeVisible();
  const button = setting.getByRole("button", { name: "tab", exact: true });
  await button.click();
  await expect(button).toHaveClass(/active/);
  await page.reload();
  await expect(setting).toBeVisible();
  await expect(button).toHaveClass(/active/);
});

test("enabling Tab quick restart works immediately and after reload", async ({
  page,
}) => {
  await openTest(page);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const setting = page.locator('[data-setting-key="quickRestart"]');
  await setting.getByRole("button", { name: "tab", exact: true }).click();
  await page.getByRole("link", { name: "Caret Home", exact: true }).click();

  for (const input of ["x", "y"]) {
    await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
    await page.locator("#words").click();
    await page.keyboard.type(input);
    await expect(page.locator("#wordsInput")).toHaveValue(` ${input}`);
    await page.keyboard.press("Tab");
    await assertRestarted(page);
    await expect(page.locator("#wordsInput")).toBeFocused();
    if (input === "x") await page.reload();
  }

  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await setting.getByRole("button", { name: "off", exact: true }).click();
  await page.getByRole("link", { name: "Caret Home", exact: true }).click();
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
  await page.locator("#words").click();
  await page.keyboard.type("z");
  await page.keyboard.press("Tab");
  await expect(page.locator("#restartTestButton")).toBeFocused();
  await expect(page.locator("#wordsInput")).toHaveValue(" z");
});
