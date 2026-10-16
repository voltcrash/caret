import { fulfillOperation, rpcInput, rpcPath } from "../start-e2e/rpc-fixtures";
import { AddResultResponseSchema } from "@oxytype/contracts/results";
import { CompletedEventSchema } from "@oxytype/schemas/results";
import {
  completeWords,
  expect,
  openTest,
  test,
  TEST_USER_ID,
} from "./fixtures";

test.use({
  authenticated: true,
  tags: [
    {
      _id: "e2e_tag",
      name: "practice",
      personalBests: { time: {}, words: {}, quote: {}, zen: {}, custom: {} },
    },
  ],
});

test("logged-in completion submits a result and applies save acknowledgement", async ({
  page,
  startSession,
}) => {
  const saved = AddResultResponseSchema.parse({
    message: "Result saved",
    data: {
      insertedId: "saved_e2e_result",
      isPb: true,
      tagPbs: [],
      xp: 100,
      dailyXpBonus: false,
      xpBreakdown: { base: 100 },
      streak: 1,
    },
  });
  const submissionPath =
    startSession === undefined ? "/api/results" : rpcPath("resultsAdd");
  await page.route(`**${submissionPath}`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    if (startSession === undefined) await route.fulfill({ json: saved });
    else await fulfillOperation(route, saved.data, saved.message);
  });
  await openTest(page);
  const submission = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === submissionPath &&
      request.method() === "POST",
  );
  await completeWords(page);
  const request = await submission;
  const result = CompletedEventSchema.parse(
    startSession === undefined
      ? (request.postDataJSON() as { result: unknown }).result
      : (rpcInput(request) as { body: { result: unknown } }).body.result,
  );

  expect(result).toMatchObject({
    uid: TEST_USER_ID,
    mode: "words",
    mode2: "15",
    acc: 100,
  });
  expect(result.hash).toBeTruthy();
  await expect(page.locator("#retrySavingResultButton")).toBeHidden();
  await expect(page.locator("#result .crown")).toBeVisible();
  await expect(
    page
      .locator("#result")
      .getByRole("button", { name: "Edit tags", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#result")).not.toContainText(
    "Failed to save result",
  );
});
