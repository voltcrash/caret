import reference from "../../packages/typing-fixtures/oracle/browser-final-word-batch.json" with { type: "json" };
import type { EventLog } from "@oxytype/web-shared/events/types";
import { expect, openTest, test } from "./fixtures";

test.use({
  config: { mode: "custom", difficulty: "normal", smoothCaret: "off" },
});
test("records the final-word DOM reset inside a multi-character commit", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "customTextSettings",
      JSON.stringify({
        text: ["one"],
        mode: "repeat",
        limit: { mode: "word", value: 1 },
        pipeDelimiter: false,
      }),
    );
  });
  await openTest(page);
  await expect(page.locator("#words .word").first()).toHaveText("one");
  await page.locator("#words").click();
  await page.keyboard.insertText("one extra");
  await expect(page.locator("#wordsInput")).toHaveValue(" extra");
  const log = await page.evaluate(() =>
    (
      window as unknown as { currentEventLog: () => EventLog }
    ).currentEventLog(),
  );
  const input = log.events.filter((event) => event.type === "input");
  expect(input).toEqual(reference.input);
});

test.describe("native input projection", () => {
  test("keeps blind-mode commit styling after letter rendering", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const config = JSON.parse(
        localStorage.getItem("config") ?? "{}",
      ) as Record<string, unknown>;
      config["blindMode"] = true;
      localStorage.setItem("config", JSON.stringify(config));
      localStorage.setItem(
        "customTextSettings",
        JSON.stringify({
          text: ["one", "two"],
          mode: "repeat",
          limit: { mode: "word", value: 2 },
          pipeDelimiter: false,
        }),
      );
    });
    await openTest(page);
    const word = page.locator('#words .word[data-wordindex="0"]');
    await word.click();
    await page.keyboard.insertText("x ");
    await expect(word.locator("letter.correct")).toHaveCount(3);
    await expect(page.locator("#words .word.active")).toHaveAttribute(
      "data-wordindex",
      "1",
    );
  });
  test("ends a complete composition exactly once through the browser listeners", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "customTextSettings",
        JSON.stringify({
          text: ["日本"],
          mode: "repeat",
          limit: { mode: "word", value: 1 },
          pipeDelimiter: false,
        }),
      );
    });
    await openTest(page);
    await page.locator("#words .word").first().click();
    await page.locator("#wordsInput").evaluate((element) => {
      const input = element as HTMLTextAreaElement;
      input.dispatchEvent(
        new CompositionEvent("compositionstart", { data: "" }),
      );
      input.value = " 日本";
      input.dispatchEvent(
        new CompositionEvent("compositionupdate", { data: "日本" }),
      );
      input.dispatchEvent(
        new InputEvent("input", {
          inputType: "insertCompositionText",
          data: "日本",
          isComposing: true,
        }),
      );
    });
    await expect(page.locator("#result")).toBeVisible();
    const log = await page.evaluate(() =>
      (window as unknown as { lastEventLog: () => EventLog }).lastEventLog(),
    );
    const inserts = log.events.filter((event) => event.type === "input");
    expect(inserts.map((event) => event.data)).toMatchObject([
      {
        data: "日",
        wordIndex: 0,
        charIndex: 0,
        inputValue: "日",
        isCompositionEnding: true,
      },
      {
        data: "本",
        wordIndex: 0,
        charIndex: 1,
        inputValue: "日本",
        isCompositionEnding: true,
      },
    ]);
    expect(
      log.events.filter(
        (event) => event.type === "timer" && event.data.event === "end",
      ),
    ).toHaveLength(1);
  });
});

test.describe("zen native projection", () => {
  test.use({
    config: { mode: "zen", smoothCaret: "off", quickRestart: "off" },
  });
  test("renders consecutive zen words, backward navigation and restart without generated targets", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    await openTest(page);
    for (let run = 0; run < 2; run++) {
      await page.locator("#words").click();
      await page.keyboard.type("one two ");
      await expect(page.locator("#words .word.active")).toHaveAttribute(
        "data-wordindex",
        "2",
      );
      await page.keyboard.press("Backspace");
      await expect(page.locator("#wordsInput")).toHaveValue(" two");
      await page.keyboard.type(" three ");
      await expect(page.locator("#words .word.active")).toHaveAttribute(
        "data-wordindex",
        "3",
      );
      const log = await page.evaluate(() =>
        (
          window as unknown as { currentEventLog: () => EventLog }
        ).currentEventLog(),
      );
      expect(log.context.targetWords).toEqual([]);
      expect(
        log.events.filter(
          (event) => event.type === "input" && "lastWord" in event.data,
        ),
      ).toEqual([]);
      await page.locator("#restartTestButton").click();
      await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
      await expect(page.locator("#words .word")).toHaveCount(1);
    }
    expect(errors).toEqual([]);
  });
});
