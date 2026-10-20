import { expect, openTest, test } from "./fixtures";

test.describe("test mode notices", () => {
  test.use({
    authenticated: true,
    config: {
      mode: "words",
      words: 15,
      showTestModesNotice: false,
      showPb: true,
      showAverage: "both",
    },
  });

  test("can enable notices in settings while signed in with averages", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openTest(page);
    await page.goto("/settings?highlight=showTestModesNotice");
    await page
      .locator('[data-setting-key="showTestModesNotice"]')
      .getByRole("button", { name: "show", exact: true })
      .click();
    await page.getByRole("link", { name: "Oxytype Home", exact: true }).click();
    await expect(page.locator("#words .word").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "english", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "no pb", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "no average", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Unable to load Oxytype", { exact: true }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
