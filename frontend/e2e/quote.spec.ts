import { completeWords, expect, openTest, test } from "./fixtures";

test.use({ config: { mode: "quote", quoteLength: [0], language: "english" } });

test("quote mode renders the fixture and completes with its source", async ({
  page,
}) => {
  await openTest(page);
  await expect(page.locator("#words .word")).toHaveText([
    "One",
    "deterministic",
    "quote",
    "for",
    "testing.",
  ]);
  await completeWords(page);
  await expect(page.locator("#result .testType .bottom").first()).toContainText(
    "quote",
  );
  await expect(page.locator("#result")).toContainText("E2E fixture");
  await expect(page.locator("#result .acc .bottom")).toHaveText("100%");
});
