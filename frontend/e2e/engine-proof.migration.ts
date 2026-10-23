import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "playwright/test";
import { toWebLog } from "@oxytype/typing-engine/text";

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
      `${JSON.stringify({ fixture: "built Cloudflare Start; Desktop Chrome; 50 warmed JSON samples; 200 UTF-16 units per sample; 7 real keyboard commits with double-rAF paint", browser: page.context().browser()?.version(), wasmBytes: (await wasm.body()).byteLength, wasmHeaders: wasm.headers(), inputToPaint, benchmark }, null, 2)}\n`,
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
    replay: {
      zen: boolean;
      words: unknown;
      steps: unknown;
      final: unknown;
      cursor: unknown;
      sounds: unknown;
      seeks: {
        target: unknown;
        words: unknown;
        cursor: unknown;
        nextIndex: number;
      }[];
    }[];
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
    inputs.push({
      log,
      queries,
      playback: reference.replay.map((replay) => ({
        zen: replay.zen,
        targets: replay.seeks.map((seek) => seek.target),
      })),
    });
    expected.push({
      analysis: outputs,
      playback: reference.replay.map((replay) => ({
        words: replay.final,
        sounds: replay.sounds,
        cursor: replay.cursor,
        stale: true,
        seeks: replay.seeks.map(({ words, cursor, nextIndex }) => ({
          words,
          cursor,
          nextIndex,
        })),
      })),
    });
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

test("Wasm owns slow-render failure and accepts observed completion time", async ({
  page,
}) => {
  await page.goto("/engine-proof");
  const run = async (
    fixture: unknown,
  ): Promise<{
    frames: {
      state: { active: boolean; ended: boolean; reason?: string };
      log: {
        events: { type: string; testMs: number; data: { event?: string } }[];
      };
    }[];
  }> => {
    await page
      .getByRole("textbox", { name: "Command fixture" })
      .fill(JSON.stringify(fixture));
    await page.getByRole("button", { name: "Run fixture" }).click();
    await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty();
    await expect(page.getByTestId("engine-proof-error")).toBeEmpty();
    return JSON.parse(
      await page.getByTestId("engine-proof-result").innerText(),
    ) as {
      frames: {
        state: { active: boolean; ended: boolean; reason?: string };
        log: {
          events: { type: string; testMs: number; data: { event?: string } }[];
        };
      }[];
    };
  };
  const completed = await run({
    name: "observed completion",
    config: { mode: "words", words: 1 },
    words: [[97]],
    commands: [
      { op: "view", now: 0, deferFinish: true },
      { op: "insert", data: [97], now: 1000, date: 1000000 },
      { op: "advance", now: 5000, date: 1004000 },
      { op: "acknowledgeFinish", now: 5050, date: 1004050 },
    ],
  });
  expect(completed.frames[1]?.state).toMatchObject({
    active: true,
    ended: false,
  });
  expect(completed.frames.at(-1)?.state).toMatchObject({
    active: false,
    ended: true,
  });
  expect(completed.frames.at(-1)?.log.events.at(-1)?.testMs).toBe(4050);
  const failed = await run({
    name: "web slow timer",
    config: { mode: "time", time: 30 },
    words: [[97, 32]],
    commands: [
      { op: "view", now: 0, monitorRenderDrift: true },
      { op: "start", now: 0, date: 0 },
      { op: "advance", now: 1501, date: 1501 },
    ],
  });
  expect(failed.frames.at(-1)?.state).toMatchObject({
    ended: true,
    reason: "slow timer",
  });
  expect(
    failed.frames
      .at(-1)
      ?.log.events.filter(
        (event) => event.type === "timer" && event.data.event === "step",
      ),
  ).toEqual([]);
});

test("owned Wasm loading retries failed downloads and preserves concurrent handles", async ({
  page,
}) => {
  let downloads = 0;
  await page.route("**/*.wasm", async (route) => {
    downloads++;
    if (downloads === 1) await route.abort("failed");
    else await route.continue();
  });
  await page.goto("/engine-proof");
  await page.getByRole("button", { name: "Run loading", exact: true }).click();
  await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty();
  await expect(page.getByTestId("engine-proof-error")).toBeEmpty();
  expect(
    JSON.parse(await page.getByTestId("engine-proof-result").innerText()),
  ).toEqual({
    recovered: true,
    shared: true,
    intact: true,
    rejected: true,
  });
  expect(downloads).toBe(6);
});

test("browser Wasm preserves learning, pace clocks and language normalization", async ({
  page,
}) => {
  const pace = JSON.parse(
    await readFile(resolve(root, "oracle/pace.json"), "utf8"),
  ) as { frames: { expected: unknown }[] };
  const normalization = JSON.parse(
    await readFile(resolve(root, "oracle/normalization.json"), "utf8"),
  ) as { expected: number[] }[];
  const learning = {
    config: { mode: "words", words: 30, funbox: ["weakspot"] },
    language: { name: "english", words: [[97], [120]] },
    random: { kind: "seeded", state: 1 },
  };
  await page.goto("/engine-proof");
  await page
    .getByRole("textbox", { name: "Command fixture" })
    .fill(JSON.stringify({ pace, normalization, learning }));
  await page.getByRole("button", { name: "Run context", exact: true }).click();
  await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty();
  await expect(page.getByTestId("engine-proof-error")).toBeEmpty();
  const result = JSON.parse(
    await page.getByTestId("engine-proof-result").innerText(),
  ) as {
    frames: unknown[];
    normalization: number[][];
    stale: boolean;
    remembered: number;
    isolated: number;
    learnedWords: number[][];
    freshWords: number[][];
    emptyLog: boolean;
    active: boolean;
  };
  expect(result.frames).toEqual(pace.frames.map((frame) => frame.expected));
  expect(result.normalization).toEqual(
    normalization.map((item) => item.expected),
  );
  expect(result.stale).toBe(true);
  expect(result.remembered).toBe(77);
  expect(result.isolated).toBe(0);
  expect(result.learnedWords).toHaveLength(30);
  expect(result.learnedWords.every((word) => word[0] === 120)).toBe(true);
  expect(result.freshWords.some((word) => word[0] === 97)).toBe(true);
  expect(result.emptyLog).toBe(true);
  expect(result.active).toBe(false);
});

test("replacement Wasm sessions repeat exact targets and reject old source replies", async ({
  page,
}) => {
  const units = (text: string): number[] =>
    Array.from({ length: text.length }, (_, i) => text.charCodeAt(i));
  const language = {
    name: "english",
    words: ["one", "two", "three", "four", "five", "six"].map(units),
  };
  const random = { kind: "seeded", state: 1 };
  const input = {
    words: { config: { mode: "words", words: 30 }, language, random },
    quote: {
      config: { mode: "quote", quoteLength: [0] },
      language,
      random,
      quotes: {
        language: "english",
        groups: [[0, 1000]],
        quotes: [
          {
            id: 1,
            text: units("one two three"),
            length: 13,
            source: "fixture",
          },
          {
            id: 2,
            text: units("four five six"),
            length: 13,
            source: "fixture",
          },
        ],
      },
    },
    sections: {
      config: { mode: "time", time: 0, funbox: ["poetry"] },
      language,
      random,
    },
  };
  await page.goto("/engine-proof");
  await page
    .getByRole("textbox", { name: "Command fixture" })
    .fill(JSON.stringify(input));
  await page.getByRole("button", { name: "Run restarts", exact: true }).click();
  await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty();
  await expect(page.getByTestId("engine-proof-error")).toBeEmpty();
  const actual = JSON.parse(
    await page.getByTestId("engine-proof-result").innerText(),
  ) as {
    before: number[][];
    after: number[][];
    quoteBefore: { words: number[][]; quote: { id: number } };
    quoteAfter: { words: number[][]; quote: { id: number } };
    nextQuote: { id: number };
    old: { id: number; generation: number };
    current: { id: number; generation: number };
    staleRejected: boolean;
    pending: unknown;
  };
  expect(actual.before).toHaveLength(30);
  expect(actual.after).toEqual(actual.before);
  expect(actual.quoteAfter).toEqual(actual.quoteBefore);
  expect(actual.nextQuote.id).not.toBe(actual.quoteBefore.quote.id);
  expect(actual.old.id).toBe(actual.current.id);
  expect(actual.old.generation).toBe(0);
  expect(actual.current.generation).toBe(1);
  expect(actual.staleRejected).toBe(true);
  expect(actual.pending).toEqual(actual.current);
});

test("Wasm restart policy matches every frozen threshold and quote preference", async ({
  page,
}) => {
  const fixture = JSON.parse(
    await readFile(resolve(root, "oracle/restart.json"), "utf8"),
  ) as {
    quick: { expected: boolean }[];
    quotes: { expected: boolean }[];
  };
  await page.goto("/engine-proof");
  await page.getByRole("textbox", { name: "Command fixture" }).fill(
    JSON.stringify({
      ...fixture,
      quotePreparation: {
        config: { mode: "quote", quoteLength: [0] },
        language: { name: "english", words: [[97]] },
        random: { kind: "seeded", state: 1 },
        quotes: {
          language: "english",
          groups: [[0, 100]],
          quotes: [{ id: 1, text: [97, 32, 98], length: 3, source: "fixture" }],
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Run policies", exact: true }).click();
  await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty();
  await expect(page.getByTestId("engine-proof-error")).toBeEmpty();
  expect(
    JSON.parse(await page.getByTestId("engine-proof-result").innerText()),
  ).toEqual({
    quick: fixture.quick.map((item) => item.expected),
    quotes: fixture.quotes.map((item) => item.expected),
  });
});

test("Wasm long custom progress keeps UTF-16, newline and bailout boundaries", async ({
  page,
}) => {
  const units = (text: string): number[] =>
    Array.from({ length: text.length }, (_, i) => text.charCodeAt(i));
  const cases: [string[], string[], boolean, number, boolean, number][] = [
    [["one ", "two"], ["on"], false, 30, false, 30],
    [["one ", "two"], ["one"], false, 30, false, 31],
    [["one\n", "two"], ["one"], false, 30, false, 30],
    [["😀 ", "two"], ["😀"], false, 30, false, 31],
    [["one ", "two"], ["one ", "t"], false, 10, true, 0],
    [["one ", "two"], ["one ", "t"], true, 10, false, 11],
    [["\ud800 ", "two"], ["\ud800"], true, 4294967295, false, 4294967296],
  ];
  const inputs = cases.map(([words, history, bailedOut, previous]) => ({
    log: {
      version: 1,
      context: {
        mode: "custom",
        mode2: "custom",
        targetWords: words.map(units),
        bailedOut,
      },
      events: history.map((inputValue, wordIndex) => ({
        type: "input",
        testMs: wordIndex,
        data: {
          inputType: "insertText",
          inputValue: units(inputValue),
          data: units(inputValue.slice(-1)),
          wordIndex,
          charIndex: Math.max(0, inputValue.length - 1),
          correct: true,
        },
      })),
    },
    queries: [{ op: "customProgress", previous }],
  }));
  await page.goto("/engine-proof");
  await page
    .getByRole("textbox", { name: "Command fixture" })
    .fill(JSON.stringify(inputs));
  await page.getByRole("button", { name: "Run analysis", exact: true }).click();
  await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty();
  await expect(page.getByTestId("engine-proof-error")).toBeEmpty();
  expect(
    JSON.parse(await page.getByTestId("engine-proof-result").innerText()),
  ).toEqual(
    cases.map(([, , , , completed, progress]) => [
      { op: "customProgress", progress: { completed, progress } },
    ]),
  );
});

test("historical surrogate halves cross browser Wasm without lossy strings", async ({
  page,
}) => {
  const references = JSON.parse(
    await readFile(resolve(root, "oracle/historical-unicode.json"), "utf8"),
  ) as {
    name: string;
    log: Parameters<typeof toWebLog>[0];
    queries: unknown[];
    expected: unknown[];
    playback: {
      zen: boolean;
      words: unknown;
      cursor: unknown;
      sounds: unknown;
      seeks: {
        target: unknown;
        words: unknown;
        cursor: unknown;
        nextIndex: number;
      }[];
    }[];
    stats: {
      history: unknown;
      corrected: unknown;
      wpm: unknown;
      raw: unknown;
      chars: {
        correctWord: number;
        incorrect: number;
        extra: number;
        missed: number;
      };
    };
  }[];
  const inputs = references.map((reference) => ({
    webLog: toWebLog(reference.log),
    queries: [...reference.queries, { op: "stats", now: 1000 }],
    playback: reference.playback.map((replay) => ({
      zen: replay.zen,
      targets: replay.seeks.map((seek) => seek.target),
    })),
  }));
  await page.goto("/engine-proof");
  await page
    .getByRole("textbox", { name: "Command fixture" })
    .fill(JSON.stringify(inputs));
  await page.getByRole("button", { name: "Run analysis", exact: true }).click();
  await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty();
  await expect(page.getByTestId("engine-proof-error")).toBeEmpty();
  const actual = JSON.parse(
    await page.getByTestId("engine-proof-result").innerText(),
  ) as {
    analysis: unknown[];
    roundTrip: unknown;
    playback: unknown;
  }[];
  expect(actual).toHaveLength(references.length);
  for (const [index, reference] of references.entries()) {
    const value = actual[index];
    if (value === undefined) throw new Error("Missing Unicode output");
    expect(
      { ...value, analysis: value.analysis.slice(0, -1) },
      reference.name,
    ).toEqual({
      analysis: reference.expected,
      roundTrip: toWebLog(reference.log),
      playback: reference.playback.map((replay) => ({
        words: replay.words,
        cursor: replay.cursor,
        sounds: replay.sounds,
        stale: true,
        seeks: replay.seeks.map(({ words, cursor, nextIndex }) => ({
          words,
          cursor,
          nextIndex,
        })),
      })),
    });
    const stats = value.analysis.at(-1) as {
      stats: {
        inputHistory: unknown;
        correctedWordsHistory: unknown;
        rawHistory: unknown;
        summary: { charStats: unknown; chartData: { wpm: unknown } };
      };
    };
    expect(stats.stats.inputHistory).toEqual(reference.stats.history);
    expect(stats.stats.correctedWordsHistory).toEqual(
      reference.stats.corrected,
    );
    expect(stats.stats.rawHistory).toEqual(reference.stats.raw);
    expect(stats.stats.summary.chartData.wpm).toEqual(reference.stats.wpm);
    const counts = reference.stats.chars;
    expect(stats.stats.summary.charStats).toEqual([
      counts.correctWord,
      counts.incorrect,
      counts.extra,
      counts.missed,
    ]);
  }
});

test("Wasm exposes frozen recovery actions and structured validation/disposal errors", async ({
  page,
}) => {
  const references = JSON.parse(
    await readFile(resolve(root, "oracle/recovery.json"), "utf8"),
  ) as {
    expected: { message: string; recovery: unknown[] };
  }[];
  const codes = [
    "noQuotes",
    "selectedQuoteMissing",
    "noFavorites",
    "noFavorites",
    "noQuoteLength",
    "noPolyglotLanguages",
    "onePolyglotLanguage",
    "polyglotDirection",
  ];
  await page.goto("/engine-proof");
  await page
    .getByRole("textbox", { name: "Command fixture" })
    .fill(JSON.stringify(references));
  await page.getByRole("button", { name: "Run recovery", exact: true }).click();
  await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty();
  await expect(page.getByTestId("engine-proof-error")).toBeEmpty();
  expect(
    JSON.parse(await page.getByTestId("engine-proof-result").innerText()),
  ).toEqual(
    references.map((reference, index) => ({
      ...reference.expected,
      code: codes[index],
      recovered: true,
      invalidCode: "invalidInput",
      unchanged: true,
      disposedCode: "disposed",
    })),
  );
});

test("binding version mismatch prevents creating a usable browser session", async ({
  page,
}) => {
  await page.addInitScript({
    content: `
    const NativeInstance = WebAssembly.Instance;
    WebAssembly.Instance = new Proxy(NativeInstance, {
      construct(target, args) {
        const instance = Reflect.construct(target, args);
        return { exports: { ...instance.exports, binding_version: () => 999 } };
      }
    });
  `,
  });
  await page.goto("/engine-proof");
  await page
    .getByRole("textbox", { name: "Command fixture" })
    .fill(await readFile(resolve(root, "commands/finite-edit.json"), "utf8"));
  await page.getByRole("button", { name: "Run fixture", exact: true }).click();
  await expect(page.getByTestId("engine-proof-error")).toHaveText(
    "Typing engine binding version mismatch",
  );
  await expect(page.getByTestId("engine-proof-result")).toBeEmpty();
  await page
    .getByRole("textbox", { name: "Type finite slice" })
    .pressSequentially("one two");
  await expect(page.getByLabel("Finite slice state")).toBeEmpty();
});

test("failed source replies preserve captured input and return exact recovery actions", async ({
  page,
}) => {
  const refs = JSON.parse(
    await readFile(resolve(root, "oracle/source-recovery.json"), "utf8"),
  ) as { expected: unknown }[];
  await page.goto("/engine-proof");
  await page
    .getByRole("textbox", { name: "Command fixture" })
    .fill(JSON.stringify(refs));
  await page
    .getByRole("button", { name: "Run source failures", exact: true })
    .click();
  await expect(page.getByTestId("engine-proof-result")).not.toBeEmpty();
  await expect(page.getByTestId("engine-proof-error")).toBeEmpty();
  expect(
    JSON.parse(await page.getByTestId("engine-proof-result").innerText()),
  ).toEqual({
    initial: refs.map((ref) => ref.expected),
    active: [false, true].map(() => ({
      recovery: [
        {
          op: "errorNotice",
          message: "Error while getting section. Please try again later",
        },
        { op: "disableFunbox", name: "poetry", noRestart: false },
        { op: "restart" },
      ],
      preserved: true,
      awaitingRecovery: true,
      failed: false,
      stale: true,
      ended: true,
    })),
  });
});
