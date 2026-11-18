import { expect, openTest, completeWords, test } from "./fixtures";

test.use({ config: { mode: "words", words: 15, smoothCaret: "off" } });

test("practice recommendations and daily goals survive a reload", async ({
  page,
}) => {
  await openTest(page);
  await completeWords(page);
  await page
    .getByRole("button", { name: "Practice words", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Practice words",
    exact: true,
  });
  const drill = modal.getByRole("button", {
    name: "Practice weak words · 60 seconds",
    exact: true,
  });
  await expect(drill).toBeEnabled();
  await modal
    .getByRole("spinbutton", { name: "Daily goal (minutes)" })
    .fill("3");
  await modal
    .getByRole("spinbutton", { name: "Daily goal (minutes)" })
    .press("Tab");
  const history = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith("caret-practice-v1:"))
      .map((key) => ({ key, value: localStorage.getItem(key) })),
  );
  expect(history).toHaveLength(1);
  expect(JSON.parse(history[0]?.value ?? "null")).toMatchObject({
    goalMinutes: 3,
  });
  await expect(modal.locator(".modal")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "test-results/practice-recommendations.png" });
  await page.reload();
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      history[0]?.key ?? "",
    ),
  ).toBe(history[0]?.value);
});

test("starts a five-word drill beside Next test and reports improved words", async ({
  page,
}) => {
  await page.clock.install();
  const targets = ["amber", "birch", "cedar", "dune", "elm", "fern"];
  await page.addInitScript((words) => {
    localStorage.setItem(
      "caret-practice-v1:guest",
      JSON.stringify({
        words: words.map((word, i) => ({
          word,
          context: "english:default",
          seen: 10,
          misses: 10 - i,
          burst: 25,
        })),
        seconds: 0,
        day: "",
        goalMinutes: 5,
      }),
    );
  }, targets);
  await openTest(page);
  await completeWords(page);
  const drill = page.locator("#result .buttons button").nth(1);
  await expect(drill).toHaveAccessibleName("Practice weak words");
  await expect(page.locator("#result")).toBeFocused();
  await drill.click();
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
  const words = page.locator("#words .word");
  const selected = targets.slice(0, 5);
  expect(new Set(await words.allTextContents())).toEqual(new Set(selected));
});
