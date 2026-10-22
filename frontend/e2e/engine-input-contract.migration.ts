import type { EventLog } from "@oxytype/typing-core/events/types";
import { expect, openTest, test } from "./fixtures";

test.use({
  config: {
    mode: "words",
    words: 15,
    difficulty: "master",
    smoothCaret: "off",
  },
});

test("master failure waits for the final unit of a multi-character browser commit", async ({
  page,
}) => {
  await openTest(page);
  const first = await page.locator("#words .word").first().textContent();
  if (first === null) throw new Error("Missing target");
  await page.locator("#words").click();
  const batch = `x${first} `;
  await page.keyboard.insertText(batch);
  await expect(page.locator("#result")).toBeVisible();
  const log = await page.evaluate(() =>
    (window as unknown as { lastEventLog: () => EventLog }).lastEventLog(),
  );
  const inputs = log.events.filter((event) => event.type === "input");
  expect(inputs).toHaveLength(batch.length);
  expect(
    inputs
      .map((event) => ("data" in event.data ? event.data.data : ""))
      .join(""),
  ).toBe(batch);
  expect(inputs.at(-1)?.data.wordIndex).toBe(0);
  const state = await page.evaluate(() =>
    (
      window as unknown as { engineMigrationState: () => { wordIndex: number } }
    ).engineMigrationState(),
  );
  expect(state.wordIndex).toBe(1);
});

test.describe("minimum burst progression", () => {
  test.use({
    config: {
      mode: "words",
      words: 15,
      difficulty: "normal",
      minBurst: "fixed",
      minBurstCustomSpeed: 1_000_000,
      smoothCaret: "off",
    },
  });
  test("advances before reporting a committed word's minimum burst failure", async ({
    page,
  }) => {
    await openTest(page);
    const first = await page.locator("#words .word").first().textContent();
    if (first === null || first.length === 0) throw new Error("Missing target");
    await page.locator("#words").click();
    await page.keyboard.insertText(first[0] as string);
    await page.waitForTimeout(100);
    await page.keyboard.insertText(`${first.slice(1)} `);
    await expect(page.locator("#result")).toBeVisible();
    const state = await page.evaluate(() =>
      (
        window as unknown as {
          engineMigrationState: () => { wordIndex: number };
        }
      ).engineMigrationState(),
    );
    expect(state.wordIndex).toBe(1);
  });
});
