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
    const frozen = JSON.parse(
      await readFile(resolve(root, "oracle", name), "utf8"),
    ) as { name: string; frames: { state: unknown }[] };
    const differences = JSON.parse(
      await readFile(resolve(root, "browser-contract-overrides.json"), "utf8"),
    ) as {
      fixture: string;
      frame: number;
      headlessState: unknown;
      browserState: unknown;
    }[];
    for (const difference of differences.filter(
      (item) => `${item.fixture}.json` === name,
    )) {
      const frame = frozen.frames[difference.frame];
      if (frame === undefined) throw new Error("Missing classified frame");
      expect(frame.state).toEqual(difference.headlessState);
      frame.state = difference.browserState;
    }
    expect(
      JSON.parse(await page.getByTestId("engine-proof-result").innerText()),
      name,
    ).toEqual(frozen);
    await expect(page.getByTestId("engine-proof-error")).toBeEmpty();
  }
});

test("all 61 original and 5 section generator references match browser Wasm", async ({
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
        sections: [] as unknown[],
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
  const names = cases.map((fixture) => fixture.name);
  const sections = JSON.parse(
    await readFile(resolve(root, "oracle/section-generation.json"), "utf8"),
  ) as {
    name: string;
    config: Record<string, unknown>;
    language: unknown;
    seed: number;
    sources: unknown[];
    repeat: boolean;
    expected: Record<string, unknown> & { extra: unknown[] };
  }[];
  for (const fixture of sections) {
    inputs.push({
      input: {
        config: fixture.config,
        language: fixture.language,
        custom: null,
        random: { kind: "seeded", state: fixture.seed },
        quotes: null,
        polyglot: [],
        selectedQuoteId: 1,
        favoriteQuoteIds: [],
        sections: fixture.sources,
      },
      repeat: fixture.repeat,
      extraWords: fixture.expected.extra.length,
    });
    expected.push({ ...fixture.expected, currentQuote: null });
    names.push(fixture.name);
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
  expect(actual).toHaveLength(66);
  for (const [index, name] of names.entries()) {
    expect(actual[index], name).toEqual(expected[index]);
  }
});

test("historical results, replay and practice agree with frozen references in Wasm", async ({
  page,
}) => {
  const references = JSON.parse(
    await readFile(resolve(root, "oracle/analysis.json"), "utf8"),
  ) as {
    name: string;
    frames: Record<string, unknown>[];
    replay: { zen: boolean; words: unknown; steps: unknown }[];
    practice: {
      missed: string;
      slow: boolean;
      result: unknown;
      notifications: string[];
    }[];
    validity: { input: unknown; reason: string | null }[];
  }[];
  const units = (text: string): number[] =>
    Array.from({ length: text.length }, (_, i) => text.charCodeAt(i));
  const inputs = [];
  const expected = [];
  for (const reference of references) {
    const fixture = JSON.parse(
      await readFile(
        resolve(root, `reference/keystrokes/${reference.name}.json`),
        "utf8",
      ),
    ) as {
      config: Record<string, unknown>;
      eventLog: {
        context: { targetWords: string[] };
        events: { testMs: number }[];
      };
      completedEvent: Record<string, unknown>;
    };
    const recorded = fixture.completedEvent;
    const context = {
      config: fixture.config,
      currentQuote:
        recorded["mode"] === "quote"
          ? { id: Number(recorded["mode2"]), group: recorded["quoteLength"] }
          : null,
      customText: recorded["customText"],
      tags: recorded["tags"],
      bailedOut: recorded["bailedOut"],
      restartCount: recorded["restartCount"],
      incompleteTests: recorded["incompleteTests"],
      incompleteSeconds: recorded["incompleteTestSeconds"],
      timestamp: recorded["timestamp"],
    };
    const log = {
      ...fixture.eventLog,
      context: {
        ...fixture.eventLog.context,
        targetWords: fixture.eventLog.context.targetWords.map(units),
      },
    };
    const queries: unknown[] = [{ op: "completed", context }];
    const outputs: unknown[] = [{ op: "completed", result: recorded }];
    for (const frame of reference.frames) {
      const { time, ...state } = frame;
      queries.push({ op: "frame", time });
      outputs.push({ op: "frame", frame: state });
    }
    for (const replay of reference.replay) {
      queries.push({ op: "replay", zen: replay.zen });
      outputs.push({
        op: "replay",
        words: replay.words,
        steps: replay.steps,
        duration: Math.max(
          0,
          ...fixture.eventLog.events.map((event) => event.testMs),
        ),
      });
    }
    const words = fixture.eventLog.context.targetWords.map((word) =>
      units(word.replace(/[ \n]$/, "")),
    );
    for (const practice of reference.practice) {
      queries.push({
        op: "practice",
        words,
        missed: practice.missed,
        slow: practice.slow,
        now: 0,
      });
      outputs.push({
        op: "practice",
        selection: {
          result: practice.result,
          notifications: practice.notifications,
        },
      });
    }
    inputs.push({ log, queries });
    expected.push(outputs);
  }
  await page.goto("/engine-proof");
  await page
    .getByRole("textbox", { name: "Command fixture" })
    .fill(JSON.stringify(inputs));
  await page.getByRole("button", { name: "Run analysis" }).click();
  await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty();
  await expect(page.getByTestId("engine-proof-error")).toBeEmpty();
  const actual = JSON.parse(
    await page.getByTestId("engine-proof-result").innerText(),
  ) as unknown[];
  for (const [index, reference] of references.entries()) {
    expect(actual[index], reference.name).toEqual(expected[index]);
  }
});

test("typed section requests preserve prepared and active input through browser Wasm", async ({
  page,
}) => {
  const units = (text: string): number[] =>
    Array.from({ length: text.length }, (_, i) => text.charCodeAt(i));
  const poem = (text: string): unknown => ({
    kind: "poem",
    title: units("Title"),
    author: units("Author"),
    lines: [units(text)],
  });
  const input = {
    prepare: {
      config: { mode: "time", time: 0, funbox: ["poetry"] },
      language: { name: "english", words: [units("base")] },
      custom: null,
      random: { kind: "seeded", state: 1 },
      quotes: null,
      polyglot: [],
      sections: [],
      selectedQuoteId: 1,
      favoriteQuoteIds: [],
    },
    initialReplies: [poem(Array.from({ length: 100 }, () => "one").join(" "))],
    steps: [
      {
        command: { op: "insert", data: units("one "), now: 0, date: 1_000_000 },
      },
      {
        command: {
          op: "insert",
          data: units("one ".repeat(100)),
          now: 100,
          date: 1_000_100,
        },
      },
      { source: poem("one two three"), now: 1000, date: 1_001_000 },
    ],
  };
  await page.goto("/engine-proof");
  await page
    .getByRole("textbox", { name: "Command fixture" })
    .fill(JSON.stringify(input));
  await page.getByRole("button", { name: "Run prepared session" }).click();
  await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty();
  await expect(page.getByTestId("engine-proof-error")).toBeEmpty();
  const result = JSON.parse(
    await page.getByTestId("engine-proof-result").innerText(),
  ) as {
    requests: { id: number; generation: number; kind: string }[];
    updates: {
      state: { wordIndex: number };
      awaitingContent: boolean;
      contentRequest?: { id: number; generation: number; kind: string };
    }[];
    snapshot: { words: number[][] };
    log: { events: { type: string; testMs: number }[] };
  };
  expect(result.requests).toEqual([
    { id: 1, generation: 0, kind: "poetry", language: "english" },
  ]);
  expect(
    result.updates.map((update) => [
      update.state.wordIndex,
      update.awaitingContent,
    ]),
  ).toEqual([
    [1, false],
    [99, true],
    [101, false],
  ]);
  expect(result.updates[0]?.contentRequest).toEqual({
    id: 2,
    generation: 0,
    kind: "poetry",
    language: "english",
  });
  expect(result.updates[1]?.contentRequest).toEqual(
    result.updates[0]?.contentRequest,
  );
  expect(result.snapshot.words[101]).toEqual(units("two "));
  const events = result.log.events.filter((event) => event.type === "input");
  expect(events).toHaveLength(404);
  expect(events.at(-1)?.testMs).toBe(100);
});
