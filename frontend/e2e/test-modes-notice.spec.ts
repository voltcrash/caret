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
    await page.getByRole("link", { name: "Caret Home", exact: true }).click();
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
      page.getByText("Unable to load Caret", { exact: true }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  for (const showAverage of ["off", "speed", "acc", "both"] as const) {
    test.describe(`saved ${showAverage} average setting`, () => {
      test.use({
        config: {
          mode: "words",
          words: 15,
          showTestModesNotice: true,
          showAverage,
        },
      });

      test("loads notices from saved settings and survives reload", async ({
        page,
      }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await openTest(page);
        const language = page.getByRole("button", {
          name: "english",
          exact: true,
        });
        const average = page.getByRole("button", {
          name: "no average",
          exact: true,
        });
        await expect(language).toBeVisible();
        if (showAverage !== "off") await expect(average).toBeVisible();

        await page.reload();
        await expect(page.locator("#words .word").first()).toBeVisible();
        await expect(language).toBeVisible();
        if (showAverage !== "off") await expect(average).toBeVisible();
        else await expect(average).toHaveCount(0);
        await expect(
          page.getByText("Unable to load Caret", { exact: true }),
        ).toHaveCount(0);
        expect(errors).toEqual([]);
      });
    });
  }
});
