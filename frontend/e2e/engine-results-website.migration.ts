import { completeWords, expect, openTest, test } from "./fixtures";

test("signed-out native results retain history, clipboard export and replay seeking", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openTest(page);
  const targets = await page.locator("#words .word").allTextContents();
  await completeWords(page);
  await page.locator("#showWordHistoryButton").click();
  await expect(page.locator("#resultWordsHistory")).toBeVisible();
  await expect(page.locator("#resultWordsHistory .word.nocursor")).toHaveCount(
    15,
  );
  await page.locator("#copyWordsListButton").click();
  await expect
    .poll(async () => page.evaluate(async () => navigator.clipboard.readText()))
    .toBe(targets.join(" "));
  await page.locator("#watchReplayButton").click();
  await expect(page.locator("#replayWords .word")).toHaveCount(15);
  await page.locator("#playpauseReplayButton").click();
  await expect(page.locator("#playpauseReplayButton")).toHaveAttribute(
    "aria-label",
    "Pause replay",
  );
  await expect(
    page.locator("#replayWords letter.correct").first(),
  ).toBeVisible();
  await page.locator("#playpauseReplayButton").click();
  await expect(page.locator("#playpauseReplayButton")).toHaveAttribute(
    "aria-label",
    "Resume replay",
  );
  await page
    .locator("#replayWords .word")
    .nth(1)
    .locator("letter")
    .first()
    .click();
  await expect(
    page.locator("#replayWords .word").first().locator("letter.correct"),
  ).toHaveCount((targets[0]?.length ?? 0) + 1);
  await page.locator("#playpauseReplayButton").click();
  await expect(page.locator("#playpauseReplayButton")).toHaveAttribute(
    "aria-label",
    "Start replay",
    { timeout: 15_000 },
  );
  await expect(page.locator("#replayWords letter.incorrect")).toHaveCount(0);
  await expect(page.locator("#replayWords letter.correct")).toHaveCount(
    targets.join(" ").length,
  );
  expect(errors).toEqual([]);
});

test.describe("native completion transport", () => {
  test.use({ authenticated: true, startSession: "browser-typing" });

  test("retries exactly the same completed payload after a temporary save error", async ({
    page,
  }) => {
    const { rpcInput, rpcPath, fulfillOperation } =
      await import("../start-e2e/rpc-fixtures");
    const { toCrossJSONAsync } = await import("seroval");
    const payloads: unknown[] = [];
    await page.route(`**${rpcPath("resultsAdd")}`, async (route) => {
      payloads.push(rpcInput(route.request()));
      if (payloads.length === 1) {
        await route.fulfill({
          contentType: "application/json",
          headers: { "x-tss-serialized": "true" },
          body: JSON.stringify(
            await toCrossJSONAsync({
              result: {
                ok: false,
                status: 503,
                message: "Temporary save failure",
              },
              context: {},
            }),
          ),
        });
        return;
      }
      await fulfillOperation(
        route,
        { insertedId: "native_retry", isPb: false, tagPbs: [] },
        "Result saved",
      );
    });
    await openTest(page);
    await page.waitForLoadState("networkidle");
    await completeWords(page);
    await expect(page.locator("#retrySavingResultButton")).toBeVisible();
    await page.locator("#retrySavingResultButton").click();
    await expect(page.locator("#retrySavingResultButton")).toBeHidden();
    await expect.poll(() => payloads.length).toBe(2);
    expect(payloads[1]).toEqual(payloads[0]);
    await expect(page.getByText("Result saved", { exact: true })).toBeVisible();
  });

  test.describe("invalid short test", () => {
    test.use({ config: { mode: "words", words: 5, smoothCaret: "off" } });
    test("shows native invalidity and never submits the result", async ({
      page,
    }) => {
      const { rpcPath } = await import("../start-e2e/rpc-fixtures");
      const submissions: string[] = [];
      page.on("request", (request) => {
        if (
          new URL(request.url()).pathname === rpcPath("resultsAdd") &&
          request.method() === "POST"
        ) {
          submissions.push(request.url());
        }
      });
      await openTest(page);
      await page.waitForLoadState("networkidle");
      await completeWords(page);
      await expect(
        page.getByText("Test invalid - too short", { exact: true }),
      ).toBeVisible();
      expect(submissions).toEqual([]);
    });
  });
});
