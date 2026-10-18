import type { Page } from "playwright/test";
import { expect, test } from "../start-e2e/fixtures";
import { rpcPath } from "../__tests__/start/rpc";
import { fromCrossJSON, type SerovalNode } from "seroval";
import { z } from "zod";

async function controlled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
    }
  });
}

async function update(page: Page, deployment: "a" | "b"): Promise<void> {
  expect(
    (await page.request.post(`/__fixture/deploy/${deployment}`)).status(),
  ).toBe(204);
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.update();
  });
  await expect
    .poll(
      async () =>
        await page.evaluate(
          async () =>
            (await navigator.serviceWorker.getRegistration())?.waiting?.state,
        ),
      { timeout: 15_000 },
    )
    .toBe("installed");
}

test("a new build and rollback wait for idle and refresh the complete offline shell", async ({
  page,
  context,
}) => {
  await page.request.post("/__fixture/deploy/a");
  await page.addInitScript(() =>
    localStorage.setItem(
      "config",
      JSON.stringify({
        mode: "words",
        words: 15,
        quickRestart: "off",
        smoothCaret: "off",
      }),
    ),
  );
  const documents: string[] = [];
  page.on("response", (response) => {
    if (
      response.request().isNavigationRequest() &&
      response.frame() === page.mainFrame()
    ) {
      documents.push(response.headers()["x-oxytype-build"] ?? "missing");
    }
  });
  await page.goto("/");
  await expect(page.locator("#words .word").first()).toBeVisible();
  await controlled(page);
  expect(documents).toEqual(["update-a"]);
  const first = page.locator("#words .word").first();
  const letter = (await first.textContent())?.[0] ?? "";
  await first.click();
  await page.keyboard.type(letter);
  await expect(page.locator("#words letter.correct")).toHaveCount(1);
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.locator("#words .word").first()).toBeVisible();
  await controlled(other);
  await other.evaluate(() => {
    const state = window as unknown as { updateQueries: number };
    state.updateQueries = 0;
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data === "oxytype:update-safety") state.updateQueries++;
    });
  });
  const otherWord = other.locator("#words .word").first();
  await otherWord.click();
  await other.keyboard.type((await otherWord.textContent())?.[0] ?? "");
  await expect(other.locator("#words letter.correct")).toHaveCount(1);
  await update(page, "b");
  await expect(
    page.getByRole("button", { name: "Reload", exact: true }),
  ).toHaveCount(0);
  expect(documents).toEqual(["update-a"]);
  await expect(page.locator("#words letter.correct")).toHaveCount(1);
  await page.locator("#restartTestButton").click();
  await expect(page.locator("#words letter.correct")).toHaveCount(0);
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
  const reload = page.getByRole("button", { name: "Reload", exact: true });
  await expect(reload).toBeVisible();
  await reload.click();
  await expect
    .poll(
      async () =>
        await other.evaluate(
          () => (window as unknown as { updateQueries: number }).updateQueries,
        ),
    )
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(
      async () =>
        (await navigator.serviceWorker.getRegistration())?.waiting?.state,
    ),
  ).toBe("installed");
  await expect(other.locator("#words letter.correct")).toHaveCount(1);
  await other.close();
  await reload.click();
  await expect.poll(() => documents).toEqual(["update-a", "update-b"]);
  await expect(page.locator("#words .word").first()).toBeVisible();
  await controlled(page);
  expect(await page.evaluate(async () => await caches.keys())).toEqual(
    expect.arrayContaining([
      "oxytype-start-update-a",
      "oxytype-start-update-b",
    ]),
  );

  // Rollback swaps the same complete server/client artifact, with the same
  // waiting-worker protocol; no database restoration or automatic save replay.
  await update(page, "a");
  await expect(reload).toBeVisible();
  await reload.click();
  await expect
    .poll(() => documents)
    .toEqual(["update-a", "update-b", "update-a"]);
  await expect(page.locator("#words .word").first()).toBeVisible();
  await controlled(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#words .word").first()).toBeVisible();
  expect(documents.at(-1)).toBe("update-a");
});

test("a pending real save holds an update; refresh and rollback never submit it again", async ({
  page,
  context,
  baseURL,
}) => {
  await page.request.post("/__fixture/deploy/a");
  const session = z
    .object({ cookie: z.string() })
    .parse(await (await page.request.get("/__fixture/session")).json());
  await context.addCookies([
    {
      name: "oxytype.session_token",
      value: session.cookie.split("=").slice(1).join("="),
      url: baseURL ?? "",
    },
  ]);
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let submissions = 0;
  let persisted = false;
  await page.route(`**${rpcPath("resultsAdd", "update-a")}*`, async (route) => {
    submissions++;
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    const saved = z
      .object({
        result: z.object({
          ok: z.literal(true),
          data: z.object({ insertedId: z.string() }),
        }),
      })
      .parse(
        fromCrossJSON((await response.json()) as SerovalNode, {
          refs: new Map(),
        }),
      );
    expect(saved.result.data.insertedId).toMatch(/^[a-f0-9]{24}$/);
    persisted = true;
    await released;
    await route.fulfill({ response });
  });
  await page.goto("/");
  await expect(page.locator("#words .word")).toHaveCount(15);
  await page.waitForLoadState("networkidle");
  await controlled(page);
  const words = await page.locator("#words .word").allTextContents();
  await page.locator("#words .word").first().click();
  await page.keyboard.type(words.join(" "), { delay: 90 });
  await expect.poll(() => persisted).toBe(true);
  await expect(page.locator("#result")).toHaveCSS("opacity", "1");
  await update(page, "b");
  await expect(
    page.getByRole("button", { name: "Reload", exact: true }),
  ).toHaveCount(0);
  expect(await (await page.request.get("/__fixture/results")).json()).toEqual({
    count: 1,
  });
  release();
  const reload = page.getByRole("button", { name: "Reload", exact: true });
  await expect(reload).toBeVisible();
  const refreshed = page.waitForResponse(
    (response) =>
      response.request().isNavigationRequest() &&
      response.headers()["x-oxytype-build"] === "update-b",
  );
  await reload.click();
  await refreshed;
  await expect(page.locator("#words .word").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await controlled(page);
  expect(submissions).toBe(1);
  expect(await (await page.request.get("/__fixture/results")).json()).toEqual({
    count: 1,
  });
  await update(page, "a");
  await expect(reload).toBeVisible();
  await reload.click();
  await expect(page.locator("#words .word").first()).toBeVisible();
  expect(await (await page.request.get("/__fixture/results")).json()).toEqual({
    count: 1,
  });
  expect(submissions).toBe(1);
});

test("a removed result function shows refresh/retry UI without replaying the save", async ({
  page,
  context,
  baseURL,
}) => {
  await page.request.post("/__fixture/deploy/a");
  const session = z
    .object({ cookie: z.string() })
    .parse(await (await page.request.get("/__fixture/session")).json());
  await context.addCookies([
    {
      name: "oxytype.session_token",
      value: session.cookie.split("=").slice(1).join("="),
      url: baseURL ?? "",
    },
  ]);
  const before: unknown = await (
    await page.request.get("/__fixture/results")
  ).json();
  let submissions = 0;
  await page.route(`**${rpcPath("resultsAdd", "update-a")}*`, async (route) => {
    submissions++;
    const response = await route.fetch({
      url: `${baseURL}/_serverFn/${"0".repeat(64)}`,
    });
    expect(response.status()).toBe(409);
    expect(response.headers()["x-oxytype-stale-client"]).toBe("1");
    await route.fulfill({ response });
  });
  await page.goto("/");
  await expect(page.locator("#words .word")).toHaveCount(15);
  await page.waitForLoadState("networkidle");
  const words = await page.locator("#words .word").allTextContents();
  await page.locator("#words .word").first().click();
  await page.keyboard.type(words.join(" "), { delay: 90 });
  await expect(page.locator("#result")).toHaveCSS("opacity", "1");
  await expect(
    page.getByText("Oxytype was updated and this page is out of date.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.locator("#retrySavingResultButton")).toBeVisible();
  expect(submissions).toBe(1);
  expect(await (await page.request.get("/__fixture/results")).json()).toEqual(
    before,
  );
});
