import { fromCrossJSON, toJSONAsync } from "seroval";
import type { SerovalNode } from "seroval";
import { z } from "zod";
import { AddResultResponseSchema } from "@oxytype/contracts/results";
import { GetUserResponseSchema } from "@oxytype/contracts/users";
import { authCookie } from "./auth-fixtures";
import { expect, test } from "./fixtures";
import { rpcPath } from "./rpc-fixtures";

test("a real browser completion persists through Start/D1 and updates the account once", async ({
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
    { name: "oxytype.session_token", value, url: baseURL ?? "" },
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
