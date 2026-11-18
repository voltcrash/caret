import { devices, expect, test } from "playwright/test";

test.use({ ...devices["Pixel 5"], serviceWorkers: "block" });

test("cold guest accepts the first painted letter after one tap", async ({
  page,
  context,
}) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 100,
    downloadThroughput: 4_000_000 / 8,
    uploadThroughput: 1_000_000 / 8,
  });

  await page.goto("/", { waitUntil: "commit" });
  const preview = page.locator("[data-initial-words] .word").first();
  const first = (await preview.textContent())?.[0];
  if (first === undefined) throw new Error("Missing first preview letter");

  const letter = page.locator("#words .word.active letter").first();
  await page.waitForFunction(() => {
    const input = document.querySelector<HTMLTextAreaElement>("#wordsInput");
    return input && !input.disabled && !input.closest("[inert]");
  });
  await letter.tap();
  await expect(page.locator("#wordsInput")).toBeFocused();
  // Sample in the page as soon as the single IME insertion is reflected.
  await page.locator("#words").evaluate((words) => {
    const observer = new MutationObserver(() => {
      if (words.querySelector(".word.active letter:first-child.correct")) {
        performance.mark("first-correct-letter");
        observer.disconnect();
      }
    });
    observer.observe(words, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  });
  await page.keyboard.insertText(first);
  await expect(letter).toHaveText(first);
  await expect(letter).toHaveClass(/\bcorrect\b/);
  await expect(
    page.locator(
      "#words letter.correct, #words letter.incorrect, #words letter.extra",
    ),
  ).toHaveCount(1);
  const acceptedMs = await page.evaluate(
    () => performance.getEntriesByName("first-correct-letter")[0]?.startTime,
  );
  if (acceptedMs === undefined) throw new Error("Missing acceptance timestamp");
  console.log(
    `Navigation to first correct letter: ${Math.round(acceptedMs)} ms`,
  );
});
