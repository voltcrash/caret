import type { Route } from "playwright/test";
import type { WebLog } from "@caret/typing-engine/text";
import { expect, openTest, test } from "./fixtures";
test.use({
  config: { mode: "time", time: 600, funbox: ["poetry"], smoothCaret: "off" },
});

async function poem(route: Route): Promise<void> {
  await route.fulfill({
    headers: { "access-control-allow-origin": "*" },
    json: [
      {
        title: "Fixture",
        author: "Fixture",
        lines: ["one ".repeat(100).trim()],
      },
    ],
  });
}
async function holdContinuation(
  page: import("playwright/test").Page,
): Promise<PromiseWithResolvers<Route>> {
  const pending = Promise.withResolvers<Route>();
  let requests = 0;
  await page.route("https://poetrydb.org/random", async (route) => {
    requests++;
    if (requests === 2) {
      pending.resolve(route);
    } else {
      await poem(route);
    }
  });
  await openTest(page);
  await page.locator("#words .word").first().click();
  await page.keyboard.insertText("one ".repeat(102));
  return pending;
}

test("resumes every original batch unit after a delayed native content reply", async ({
  page,
}) => {
  const pending = await holdContinuation(page);
  const source = await pending.promise;
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              engineMigrationState: () => { wordIndex: number };
            }
          ).engineMigrationState().wordIndex,
      ),
    )
    .toBe(99);
  await poem(source);
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              engineMigrationState: () => { wordIndex: number };
            }
          ).engineMigrationState().wordIndex,
      ),
    )
    .toBe(102);
  const log = await page.evaluate(() =>
    (window as unknown as { currentEventLog: () => WebLog }).currentEventLog(),
  );
  const inputs = log.events.filter((event) => event.type === "input");
  expect(inputs).toHaveLength(408);
  expect(new Set(inputs.map((event) => event.testMs))).toEqual(new Set([0]));
  await expect(page.locator("#wordsInput")).toHaveValue(" ");
});

test("cancels a pending batch on navigation without an unhandled rejection or stale input", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  const pending = await holdContinuation(page);
  const source = await pending.promise;
  const failed = page.waitForEvent("requestfailed", {
    predicate: (request) => request === source.request(),
  });
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await failed;
  await expect(page.locator("#group_behavior")).toBeVisible();
  await page.goto("/");
  await expect(page.locator("#words .word.active")).toHaveAttribute(
    "data-wordindex",
    "0",
  );
  await expect(page.locator("#wordsInput")).toHaveValue(" ");
  expect(errors).toEqual([]);
});

test("recovers from an unavailable active source without scoring a typing failure", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  const pending = await holdContinuation(page);
  const source = await pending.promise;
  await source.fulfill({
    status: 503,
    headers: { "access-control-allow-origin": "*" },
    body: "unavailable",
  });
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("config") ?? "{}") as {
            funbox?: string[];
          },
      ),
    )
    .toMatchObject({ funbox: [] });
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
  await expect(page.locator("#words .word.active")).toHaveAttribute(
    "data-wordindex",
    "0",
  );
  await expect(page.locator("#result")).toBeHidden();
  expect(errors).toEqual([]);
});
