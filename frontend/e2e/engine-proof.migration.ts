import { readFile, readdir, writeFile } from "node:fs/promises";
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
  for (const name of (await readdir(resolve(root, "commands"))).filter(
    (entry) => entry.endsWith(".json"),
  )) {
    await page
      .getByRole("textbox", { name: "Command fixture" })
      .fill(await readFile(resolve(root, "commands", name), "utf8"));
    await page.getByRole("button", { name: "Run fixture" }).click();
    await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty();
    const frozen: unknown = JSON.parse(
      await readFile(resolve(root, "oracle", name), "utf8"),
    );
    expect(
      JSON.parse(await page.getByTestId("engine-proof-result").innerText()),
      name,
    ).toEqual(frozen);
    await expect(page.getByTestId("engine-proof-error")).toBeEmpty();
  }
});

test("all 61 unchanged generator snapshots match browser Wasm", async ({
  page,
}) => {
  const staticRoot = resolve(import.meta.dirname, "../static");
  const cases = JSON.parse(
    await readFile(resolve(root, "reference/words/cases.json"), "utf8"),
  ) as {
    name: string;
    seed: number;
    config: Record<string, unknown>;
    customText?: unknown;
    repeat?: boolean;
    extraWords?: number;
    selectedQuoteId?: number;
  }[];
  const units = (text: string): number[] =>
    Array.from({ length: text.length }, (_, index) => text.charCodeAt(index));
  const neutral = (value: unknown, key = ""): unknown => {
    if (
      typeof value === "string" &&
      [
        "words",
        "text",
        "britishText",
        "word",
        "wordRaw",
        "additionalAccents",
      ].includes(key)
    ) {
      return units(value);
    }
    if (Array.isArray(value)) return value.map((item) => neutral(item, key));
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, neutral(item, key)]),
      );
    }
    return value;
  };
  const inputs = [];
  const expected = [];
  let quotesLoaded = false;
  for (const fixture of cases) {
    const language =
      typeof fixture.config["language"] === "string"
        ? fixture.config["language"]
        : "english";
    const polyglot =
      fixture.config["funbox"] instanceof Array &&
      fixture.config["funbox"].includes("polyglot")
        ? await Promise.all(
            (fixture.config["customPolyglot"] as string[]).map(async (name) =>
              neutral(
                JSON.parse(
                  await readFile(
                    resolve(staticRoot, `languages/${name}.json`),
                    "utf8",
                  ),
                ),
              ),
            ),
          )
        : [];
    let quotes: unknown = null;
    if (fixture.config["mode"] === "quote" && !quotesLoaded) {
      quotes = neutral(
        JSON.parse(
          await readFile(resolve(staticRoot, "quotes/english.json"), "utf8"),
        ),
      );
      quotesLoaded = true;
    }
    inputs.push({
      input: {
        config: fixture.config,
        language: neutral(
          JSON.parse(
            await readFile(
              resolve(staticRoot, `languages/${language}.json`),
              "utf8",
            ),
          ),
        ),
        custom: neutral(fixture.customText ?? null),
        random: { kind: "seeded", state: fixture.seed },
        quotes,
        polyglot,
        selectedQuoteId: fixture.selectedQuoteId ?? 1,
        favoriteQuoteIds: [],
      },
      repeat: fixture.repeat,
      extraWords: fixture.extraWords,
    });
    expected.push(
      neutral(
        JSON.parse(
          await readFile(
            resolve(root, `reference/words/__snapshots__/${fixture.name}.json`),
            "utf8",
          ),
        ),
      ),
    );
  }
  await page.goto("/engine-proof");
  await page
    .getByRole("textbox", { name: "Command fixture" })
    .fill(JSON.stringify(inputs));
  await page.getByRole("button", { name: "Run generation" }).click();
  await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty({
    timeout: 30_000,
  });
  await expect(page.getByTestId("engine-proof-error")).toBeEmpty();
  const actual = JSON.parse(
    await page.getByTestId("engine-proof-result").innerText(),
  ) as unknown[];
  expect(actual).toHaveLength(61);
  for (const [index, fixture] of cases.entries()) {
    expect(actual[index], fixture.name).toEqual(expected[index]);
  }
});
