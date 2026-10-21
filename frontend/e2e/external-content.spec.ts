import { expect, openTest, test } from "./fixtures";

for (const [language, subdomain] of [
  ["english", "en"],
  ["german", "de"],
] as const) {
  test.describe(`${language} Wikipedia under production CSP`, () => {
    test.use({
      config: { mode: "words", words: 15, language, funbox: ["wikipedia"] },
    });

    test("loads a summary and its extract from the selected language", async ({
      page,
    }) => {
      const requests: string[] = [];
      await page.route("https://*.wikipedia.org/**", async (route) => {
        requests.push(route.request().url());
        await route.fulfill({
          headers: { "access-control-allow-origin": "*" },
          json: route.request().url().includes("/w/api.php")
            ? {
                query: {
                  pages: {
                    "1": {
                      extract:
                        "<p>The quiet morning brings the light across a field of flowers where the birds sing softly.</p>",
                    },
                  },
                },
              }
            : { title: "Morning", pageid: 1 },
        });
      });
      await openTest(page);
      expect(requests.map((url) => new URL(url).origin)).toEqual([
        `https://${subdomain}.wikipedia.org`,
        `https://${subdomain}.wikipedia.org`,
      ]);
      expect(requests.map((url) => new URL(url).pathname)).toEqual([
        "/api/rest_v1/page/random/summary",
        "/w/api.php",
      ]);
      await expect(page.locator("#words .word").first()).toHaveText("The");
      const saved = await page.evaluate(() => {
        const config = JSON.parse(localStorage.getItem("config") ?? "{}") as {
          funbox?: string[];
        };
        return config.funbox;
      });
      expect(saved).toEqual(["wikipedia"]);
    });
  });
}

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
