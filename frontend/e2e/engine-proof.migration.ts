import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "playwright/test";

const root = resolve(import.meta.dirname, "../../packages/typing-fixtures");
test("native fixture matches browser Wasm through built Cloudflare assets", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/engine-proof");
  const response = page.waitForResponse((response) =>
    response.url().endsWith(".wasm"),
  );
  await page
    .getByRole("textbox", { name: "Command fixture" })
    .fill(await readFile(resolve(root, "commands/finite-edit.json"), "utf8"));
  await page.getByRole("button", { name: "Run fixture" }).click();
  const wasm = await response;
  expect(wasm.status()).toBe(200);
  expect(wasm.headers()["content-type"]).toContain("application/wasm");
  await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty();
  const actual: unknown = JSON.parse(
    await page.getByTestId("engine-proof-result").innerText(),
  );
  const expected: unknown = JSON.parse(
    await readFile(resolve(root, "oracle/finite-edit.json"), "utf8"),
  );
  expect(actual).toEqual(expected);
  expect(errors).toEqual([]);
  await page.getByRole("textbox", { name: "Type finite slice" }).fill("");
  const inputToPaint: number[] = [];
  for (const character of "one two") {
    await page.evaluate(() => {
      const input = document.querySelector(
        'input[aria-label="Type finite slice"]',
      );
      if (input === null) throw new Error("Missing slice input");
      input.addEventListener(
        "beforeinput",
        () => performance.mark("slice-input"),
        { once: true },
      );
    });
    await page
      .getByRole("textbox", { name: "Type finite slice" })
      .pressSequentially(character);
    inputToPaint.push(
      await page.evaluate(async () => {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        return (
          performance.now() -
          (performance.getEntriesByName("slice-input").at(-1)?.startTime ??
            performance.now())
        );
      }),
    );
  }
  await expect(page.getByLabel("Finite slice state")).toHaveText("finished");
  const output = process.env["ENGINE_PROOF_OUTPUT"];
  if (output !== undefined) {
    const benchmark: unknown = JSON.parse(
      await page.getByTestId("engine-proof-benchmark").innerText(),
    );
    await writeFile(
      output,
      `${JSON.stringify({ fixture: "built Cloudflare Start; Desktop Chrome; 50 warmed samples per boundary; 200 UTF-16 units per sample; 7 real keyboard commits with double-rAF paint", browser: page.context().browser()?.version(), wasmBytes: (await wasm.body()).byteLength, wasmHeaders: wasm.headers(), inputToPaint, benchmark }, null, 2)}\n`,
    );
  }
  // Invalid creation must be recoverable; subsequent valid creation still works.
  await page.getByRole("textbox", { name: "Command fixture" }).fill(
    JSON.stringify({
      name: "invalid",
      config: { mode: "invalid" },
      words: [],
      commands: [],
    }),
  );
  await page.getByRole("button", { name: "Run fixture" }).click();
  await expect(page.getByTestId("engine-proof-error")).toContainText(
    "Invalid mode",
  );
  await page
    .getByRole("textbox", { name: "Command fixture" })
    .fill(await readFile(resolve(root, "commands/finite-edit.json"), "utf8"));
  await page.getByRole("button", { name: "Run fixture" }).click();
  await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty();
  expect(
    JSON.parse(await page.getByTestId("engine-proof-result").innerText()),
  ).toEqual(expected);
});
