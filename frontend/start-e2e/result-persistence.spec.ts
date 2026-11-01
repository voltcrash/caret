import { fromCrossJSON, toJSONAsync } from "seroval";
import type { SerovalNode } from "seroval";
import { z } from "zod";
import { AddResultResponseSchema } from "@caret/contracts/results";
import { GetUserResponseSchema } from "@caret/contracts/users";
import { authCookie } from "./auth-fixtures";
import { expect, test } from "./fixtures";
import { rpcPath, rpcInput } from "./rpc-fixtures";

test("an immediate retry after a network failure still earns a PB", async ({
  page,
  context,
  baseURL,
}) => {
  const value =
    authCookie("browser-save-retry")
      .split(";")[0]
      ?.split("=")
      .slice(1)
      .join("=") ?? "";
  await context.addCookies([
    { name: "caret.session_token", value, url: baseURL ?? "" },
  ]);
  await page.route(
    `**${rpcPath("resultsAdd")}*`,
    async (route) => await route.abort("failed"),
    { times: 1 },
  );
  await page.goto("/");
  await expect(page.locator("#words .word")).toHaveCount(15);
  await page.waitForLoadState("networkidle");
  const words = await page.locator("#words .word").allTextContents();
  await page.locator("#words .word").first().click();
  await page.keyboard.type(words.join(" "), { delay: 90 });
  const retry = page.locator("#retrySavingResultButton");
  await expect(retry).toBeVisible();
  const savedResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === rpcPath("resultsAdd"),
  );
  await retry.click();
  const response = await savedResponse;
  expect(response.status()).toBe(200);
  const input = rpcInput(response.request()) as {
    body: { result: { offline?: boolean } };
  };
  expect(input.body.result.offline).not.toBe(true);
  const saved = z
    .object({ result: AddResultResponseSchema })
    .parse(
      fromCrossJSON((await response.json()) as SerovalNode, {
        refs: new Map(),
      }),
    ).result.data;
  expect(saved.isPb).toBe(true);
  expect(saved.xp).toBeGreaterThan(0);
  await expect(page.locator("#result .crown")).toBeVisible();
});

test("recovers a lost commit acknowledgement after reload without duplicate progression", async ({
  page,
  context,
  baseURL,
}) => {
  const value =
    authCookie("browser-outbox").split(";")[0]?.split("=").slice(1).join("=") ??
    "";
  await context.addCookies([
    { name: "caret.session_token", value, url: baseURL ?? "" },
  ]);
  const lost = Promise.withResolvers<undefined>();
  await page.route(`**${rpcPath("resultsAdd")}*`, async (route) => {
    const response = await route.fetch();
    expect(response.status(), await response.text()).toBe(200);
    await route.abort("failed");
    lost.resolve(undefined);
  });
  await page.goto("/");
  await expect(page.locator("#words .word")).toHaveCount(15);
  await page.waitForLoadState("networkidle");
  const words = await page.locator("#words .word").allTextContents();
  await page.locator("#words .word").first().click();
  await page.keyboard.type(words.join(" "), { delay: 90 });
  await lost.promise;
  await expect(page.locator("#retrySavingResultButton")).toBeVisible();
  await expect(page.getByText(/1 result\(s\) pending upload/)).toBeVisible();
  await page.unroute(`**${rpcPath("resultsAdd")}*`);
  const retried = page.waitForResponse(
    (response) => new URL(response.url()).pathname === rpcPath("resultsAdd"),
  );
  await page.reload();
  const response = await retried;
  expect(response.status()).toBe(200);
  const saved = fromCrossJSON((await response.json()) as SerovalNode, {
    refs: new Map(),
  }) as { result: { data: { alreadySaved?: boolean; xp: number } } };
  expect(saved.result.data).toMatchObject({ alreadySaved: true, xp: 0 });
  const read = await page.request.get(
    `${rpcPath("usersGet")}?payload=${encodeURIComponent(JSON.stringify(await toJSONAsync({ data: { query: { client: "web" } } })))}`,
    { headers: { origin: baseURL ?? "" } },
  );
  const account = fromCrossJSON((await read.json()) as SerovalNode, {
    refs: new Map(),
  }) as { result: { data: { completedTests: number } } };
  expect(account.result.data.completedTests).toBe(1);
});

test("a real browser completion persists through Start/PostgreSQL and updates the account once", async ({
  page,
  context,
  baseURL,
}) => {
  const value =
    authCookie("browser-result-persistence")
      .split(";")[0]
      ?.split("=")
      .slice(1)
      .join("=") ?? "";
  await context.addCookies([
    { name: "caret.session_token", value, url: baseURL ?? "" },
  ]);
  const legacyWrites: string[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname === "/api/results" &&
      request.method() === "POST"
    ) {
      legacyWrites.push(request.url());
    }
  });
  await page.goto("/");
  await expect(page.locator("#words .word")).toHaveCount(15);
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
  await page.waitForLoadState("networkidle");
  const words = await page.locator("#words .word").allTextContents();
  const pending = page.waitForResponse(
    (response) => new URL(response.url()).pathname === rpcPath("resultsAdd"),
  );
  await page.locator("#words .word").first().click();
  await page.keyboard.type(words.join(" "), { delay: 90 });
  const response = await pending;
  expect(response.status()).toBe(200);
  const saved = z.object({ result: AddResultResponseSchema }).parse(
    fromCrossJSON((await response.json()) as SerovalNode, {
      refs: new Map(),
    }),
  ).result.data;
  expect(saved.insertedId).toMatch(/^[a-f0-9]{24}$/);
  expect(saved.isPb).toBe(true);
  expect(saved.xp).toBeGreaterThan(0);
  await expect(page.locator("#result .crown")).toBeVisible();
  await expect(page.locator("#retrySavingResultButton")).toBeHidden();
  const read = await page.request.get(
    `${rpcPath("usersGet")}?payload=${encodeURIComponent(JSON.stringify(await toJSONAsync({ data: { query: { client: "web" } } })))}`,
    { headers: { origin: baseURL ?? "" } },
  );
  expect(read.status()).toBe(200);
  const account = z
    .object({ result: GetUserResponseSchema })
    .parse(
      fromCrossJSON((await read.json()) as SerovalNode, { refs: new Map() }),
    ).result.data;
  expect(account.completedTests).toBe(1);
  expect(account.xp).toBe(saved.xp);
  expect(legacyWrites).toEqual([]);
});
