import { expect, test } from "./fixtures";

for (const width of [1280, 320]) {
  test(`profile hint supports keyboard dismissal and fits a ${width}px viewport`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 720 });
    await page.goto("/profile/fixture-profile");
    const trigger = page.getByText(/^Joined /).first();
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAccessibleDescription(/.+/);
    const hint = await trigger.evaluate(
      (element) =>
        document.getElementById(element.getAttribute("aria-describedby") ?? "")
          ?.textContent ?? "",
    );

    await trigger.focus();
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText(hint);
    await expect
      .poll(async () => {
        const box = await tooltip.boundingBox();
        return (
          box !== null &&
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= width &&
          box.y + box.height <= 720
        );
      })
      .toBe(true);
    await info.attach(`tooltip-${width}`, {
      body: await page.screenshot({
        path: info.outputPath(`tooltip-${width}.png`),
      }),
      contentType: "image/png",
    });

    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.keyboard.press("Tab");
    await expect(trigger).not.toBeFocused();

    await trigger.hover();
    await expect(tooltip).toBeVisible();
    await tooltip.hover();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);
  });
}
