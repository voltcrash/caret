import type { BrowserContext, Page } from "playwright/test";

import { authCookie } from "./auth-fixtures";
import { expect, test } from "./fixtures";

// Hold actual downloads rather than receiving assets from the service worker.
test.use({ serviceWorkers: "block" });

async function signIn(context: BrowserContext): Promise<void> {
  const value =
    authCookie("browser-private")
      .split(";")[0]
      ?.split("=")
      .slice(1)
      .join("=") ?? "";
  await context.addCookies([
    { name: "oxytype.session_token", value, url: "http://127.0.0.1:4185" },
  ]);
}

/** Holds a lazy browser chunk until the returned release runs. */
async function holdChunk(
  page: Page,
  pattern: string,
): Promise<{ blocked: () => boolean; release: () => void }> {
  const bundle = Promise.withResolvers<undefined>();
  let blocked = false;
  await page.route(pattern, async (route) => {
    blocked = true;
    await bundle.promise;
    await route.continue();
  });
  return { blocked: () => blocked, release: () => bundle.resolve(undefined) };
}

const pages = [
  {
    name: "account",
    url: "/account",
    chunk: "**/assets/content.client-*.js",
    status: "Loading account",
    signedIn: true,
  },
  {
    name: "leaderboards",
    url: "/leaderboards",
    chunk: "**/assets/view.client-*.js",
    status: "Loading leaderboard",
    signedIn: false,
  },
  {
    name: "sign in",
    url: "/login",
    chunk: "**/assets/panel.client-*.js",
    status: "Loading sign in",
    signedIn: false,
  },
];

for (const target of pages) {
  test(`${target.name} shows its skeleton until its browser code loads`, async ({
    page,
    context,
  }) => {
    if (target.signedIn) await signIn(context);
    const chunk = await holdChunk(page, target.chunk);
    const loading = page.getByRole("status", { name: target.status });
    try {
      await page.goto(target.url);
      await expect.poll(chunk.blocked).toBe(true);
      await expect(page.locator("#startupScreen")).toBeHidden();
      await expect(loading).toBeVisible();
      await expect(loading).toHaveAttribute("aria-busy", "true");
    } finally {
      chunk.release();
    }
    await expect(loading).toBeHidden();
  });
}

test("a profile shows its skeleton until the full profile loads", async ({
  page,
}) => {
  const chunk = await holdChunk(page, "**/assets/profile.client-*.js");
  try {
    await page.goto("/profile/fixture-profile");
    await expect.poll(chunk.blocked).toBe(true);
    await expect(page.locator("#startupScreen")).toBeHidden();
    await expect(page.getByText("fixture-profile public bio")).toHaveCount(0);
  } finally {
    chunk.release();
  }
  await expect(page.getByText("fixture-profile public bio")).toBeVisible();
});
