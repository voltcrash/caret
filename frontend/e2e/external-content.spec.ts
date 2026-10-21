import { expect, openTest, test } from "./fixtures";

test.describe("poetry under production CSP", () => {
  test.use({ config: { mode: "words", words: 15, funbox: ["poetry"] } });

  test("loads and retains the selected poem", async ({ page }) => {
    const content =
      "The quiet morning brings the light across a field of flowers where the birds sing softly.";
    const requests: string[] = [];
    await page.route("https://poetrydb.org/random", async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        headers: { "access-control-allow-origin": "*" },
        json: [{ title: "Morning", author: "Fixture", lines: [content] }],
      });
    });
    await openTest(page);
    expect(requests).toEqual(["https://poetrydb.org/random"]);
    await expect(page.locator("#words .word").first()).toHaveText("The");
    const saved = await page.evaluate(() => {
      const config = JSON.parse(localStorage.getItem("config") ?? "{}") as {
        funbox?: string[];
      };
      return config.funbox;
    });
    expect(saved).toEqual(["poetry"]);
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await expect(page.locator('[data-setting-key="funbox"]')).toBeVisible();
  });
});
