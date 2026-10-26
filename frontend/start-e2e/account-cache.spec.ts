import type { BrowserContext, Page } from "playwright/test";
import { SessionStateSchema } from "@caret/schemas/auth-session";
import { fromCrossJSON, type SerovalNode } from "seroval";
import { z } from "zod";
import type { StoredQueryCache } from "../src/app/query-cache.client";
import { authCookie } from "./auth-fixtures";
import { expect, test } from "./fixtures";
import { rpcPath } from "./rpc-fixtures";

test.use({ serviceWorkers: "block" });

async function signIn(context: BrowserContext, token: string): Promise<void> {
  const value =
    authCookie(token).split(";")[0]?.split("=").slice(1).join("=") ?? "";
  await context.addCookies([
    { name: "caret.session_token", value, url: "http://127.0.0.1:4185" },
  ]);
}

async function cached(page: Page): Promise<StoredQueryCache | undefined> {
  return await page.evaluate(
    async () =>
      await new Promise<StoredQueryCache | undefined>((resolve, reject) => {
        const request = indexedDB.open("oxytype-query-cache", 1);
        // SSR content can appear before the app initializes storage. Inspection
        // must never create an empty database that prevents its schema upgrade.
        request.onupgradeneeded = () => request.transaction?.abort();
        request.onerror = () =>
          request.error?.name === "AbortError"
            ? resolve(undefined)
            : reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("cache")) {
            db.close();
            resolve(undefined);
            return;
          }
          const read = db
            .transaction("cache")
            .objectStore("cache")
            .get("current");
          read.onsuccess = () => {
            db.close();
            resolve(read.result as StoredQueryCache | undefined);
          };
          read.onerror = () => {
            db.close();
            reject(read.error);
          };
        };
      }),
  );
}

for (const target of ["quickRestart", "accountName"]) {
  test(`settings render local preferences during a pending session; highlight ${target} on mount`, async ({
    page,
    context,
  }) => {
    await signIn(context, "browser-cache");
    const session = Promise.withResolvers<undefined>();
    let blocked = false;
    await page.route(`**${rpcPath("getSessionState")}*`, async (route) => {
      blocked = true;
      await session.promise;
      await route.continue();
    });
    try {
      await page.goto(`/settings?highlight=${target}`, {
        waitUntil: "domcontentloaded",
      });
      await expect.poll(() => blocked).toBe(true);
      await expect(
        page.getByRole("textbox", { name: "Search settings" }),
      ).toBeVisible();
      await expect(
        page.getByRole("status", { name: "Loading settings" }),
      ).toBeHidden();
      await expect(
        page.locator('[data-setting-key="quickRestart"]'),
      ).toBeVisible();
      await expect(page.locator("#group_account")).toHaveCount(0);
      if (target === "quickRestart") {
        await expect(
          page.locator(`[data-setting-key="${target}"]`),
        ).toHaveClass(/settings-highlight/);
      }
    } finally {
      session.resolve(undefined);
    }
    // Account controls insert content above local settings after login settles.
    await expect(page.locator("#group_account")).toBeVisible();
    await expect(page.locator(`[data-setting-key="${target}"]`)).toHaveClass(
      /settings-highlight/,
    );
    await expect(
      page.locator(`[data-setting-key="${target}"]`),
    ).toBeInViewport();
  });
}

test("unfinished signups see local settings without registered account controls", async ({
  page,
  context,
}) => {
  await signIn(context, "browser-cache-pending");
  const session = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === rpcPath("getSessionState"),
  );
  await page.goto("/settings");
  const state = z.object({ result: SessionStateSchema }).parse(
    fromCrossJSON((await (await session).json()) as SerovalNode, {
      refs: new Map(),
    }),
  );
  expect(state.result.user?.registered).toBe(false);
  await expect(
    page.getByRole("textbox", { name: "Search settings" }),
  ).toBeVisible();
  await expect(page.locator("#group_account")).toHaveCount(0);
  await expect(page.locator('[data-setting-key="tags"]')).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Page sections" })
      .getByRole("button", { name: "account", exact: true }),
  ).toHaveCount(0);
  await expect.poll(async () => await cached(page)).toBeUndefined();
});

test("account restores IndexedDB before network refresh, isolates actors and clears on sign-out", async ({
  page,
  context,
}) => {
  await signIn(context, "browser-cache");
  await page.goto("/account");
  await expect(page.getByText("filters", { exact: true })).toBeVisible();
  await expect
    .poll(
      async () =>
        (await cached(page))?.client.queries.filter(
          (query) => query.queryKey[3] === "results",
        ).length,
    )
    .toBe(1);
  const previousActor = (await cached(page))?.actor;
  const network = Promise.withResolvers<undefined>();
  const pending: string[] = [];
  for (const name of ["usersGet", "resultsGet"]) {
    await page.route(`**${rpcPath(name)}*`, async (route) => {
      pending.push(name);
      await network.promise;
      await route.continue();
    });
  }
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("filters", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Loading account" }),
    ).toBeHidden();
    await expect.poll(() => pending).toContain("usersGet");
    await expect.poll(() => pending).toContain("resultsGet");
  } finally {
    network.resolve(undefined);
  }
  await page.unrouteAll({ behavior: "wait" });
  let sessions = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === rpcPath("getSessionState")) {
      sessions++;
    }
  });
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Search settings" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page.getByText("filters", { exact: true })).toBeVisible();
  expect(sessions).toBe(0);
  await signIn(context, "browser-cache-b");
  await page.reload();
  await expect(
    page.locator("#pageAccount").getByText("browser-cache-b", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await cached(page))?.actor)
    .not.toBe(previousActor);
  await page.getByRole("link", { name: "Account", exact: true }).hover();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?redirect=%2Faccount$/);
  await expect.poll(async () => await cached(page)).toBeUndefined();
});

test("profile history navigation restores disk data while its RPC refresh is pending", async ({
  page,
  context,
}) => {
  await signIn(context, "browser-cache");
  await page.goto("/profile/fixture-profile");
  await expect(page.getByText("fixture-profile public bio")).toBeVisible();
  await expect
    .poll(async () =>
      (await cached(page))?.client.queries.some(
        (query) =>
          query.queryKey[0] === "public" && query.queryKey[1] === "profile",
      ),
    )
    .toBe(true);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Search settings" }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  const network = Promise.withResolvers<undefined>();
  let blocked = false;
  await page.route(`**${rpcPath("getProfile")}*`, async (route) => {
    blocked = true;
    await network.promise;
    await route.continue();
  });
  try {
    await page.goBack();
    await expect(page).toHaveURL(/\/profile\/fixture-profile$/);
    await expect(page.getByText("fixture-profile public bio")).toBeVisible();
    await expect.poll(() => blocked).toBe(true);
  } finally {
    network.resolve(undefined);
  }
});
