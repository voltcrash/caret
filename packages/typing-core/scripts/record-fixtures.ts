/**
 * Records keystroke parity fixtures from the real web frontend.
 *
 * Drives the frontend dev server with Playwright, types a scripted (seeded)
 * keystroke plan into the test and saves what the web produced: the event log
 * and the completed event. Run with the dev server up:
 *
 *   vp run dev-fe
 *   node packages/typing-core/scripts/record-fixtures.ts [url] [fixture names...]
 *
 * Set CHROME to a Chromium executable if Playwright's bundled one is missing.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import {
  mulberry32,
  scriptedKey as key,
  type Action,
  type Rng,
} from "./lib/keystroke-plan.ts";

type WordPlan = (word: string, wordIndex: number, rng: Rng) => Action[];

type Scenario = {
  name: string;
  description: string;
  config: Record<string, unknown>;
  customText?: Record<string, unknown>;
  seed: number;
  // returns the actions for the given target word (with its commit char)
  plan: WordPlan;
  // keys pressed after the last word when the test does not end by itself
  finish?: Action[];
  maxWords?: number;
};

const deleteWordModifier = process.platform === "darwin" ? "Alt" : "Control";

function typeText(rng: Rng, text: string, fast = false): Action[] {
  return text.split("").map((c) => key(rng, c, fast));
}

const clean: WordPlan = (word, _i, rng) => typeText(rng, word);

const scenarios: Scenario[] = [
  {
    name: "words-10-clean",
    description: "words 10, no mistakes, overlapping keys",
    config: { mode: "words", words: 10 },
    seed: 1,
    plan: (word, _i, rng) => typeText(rng, word, true),
  },
  {
    name: "words-10-errors",
    description:
      "words 10 with a corrected typo, extra letters, a skipped word, word delete and a backtrack",
    config: { mode: "words", words: 10 },
    seed: 2,
    plan: (word, i, rng) => {
      const letters = word.trimEnd();
      if (i === 1) {
        // typo, then fix it
        return [
          ...typeText(rng, letters.slice(0, 1)),
          key(rng, "q"),
          key(rng, "Backspace"),
          ...typeText(rng, word.slice(1)),
        ];
      }
      if (i === 3) {
        // extra letters committed
        return typeText(rng, `${letters}xx `);
      }
      if (i === 5) {
        // delete the whole word and retype it
        return [
          ...typeText(rng, letters.slice(0, 2)),
          key(rng, `${deleteWordModifier}+Backspace`),
          ...typeText(rng, word),
        ];
      }
      if (i === 6) {
        // skip the word half typed, go back to it and finish it
        const half = letters.slice(0, Math.max(1, letters.length - 2));
        return [
          ...typeText(rng, `${half} `),
          key(rng, "Backspace"),
          ...typeText(rng, word.slice(half.length)),
        ];
      }
      return typeText(rng, word);
    },
  },
  {
    name: "time-15",
    description: "time 15 with a pause, ends mid word",
    config: { mode: "time", time: 15 },
    seed: 3,
    plan: (word, i, rng) => {
      const actions = typeText(rng, word);
      if (i === 8) return [{ kind: "pause", ms: 1600 }, ...actions];
      if (i === 4) return [...actions.slice(0, 1), key(rng, "p"), ...actions];
      return actions;
    },
    maxWords: 200,
  },
  {
    name: "zen",
    description:
      "zen mode with newlines and a backspace, finished with shift+enter",
    config: { mode: "zen" },
    seed: 4,
    plan: () => [],
    finish: [],
  },
  {
    name: "custom-repeat",
    description: "custom text, repeat, word limit 9",
    config: { mode: "custom" },
    customText: {
      text: [
        "The",
        "quick",
        "brown",
        "fox",
        "jumps",
        "over",
        "the",
        "lazy",
        "dog",
      ],
      mode: "repeat",
      limit: { value: 9, mode: "word" },
      pipeDelimiter: false,
    },
    seed: 5,
    plan: (word, i, rng) =>
      i === 2 ? typeText(rng, `${word.trimEnd()}s `) : clean(word, i, rng),
  },
  {
    name: "quote-short",
    description: "short quote with one typo",
    config: { mode: "quote", quoteLength: [0] },
    seed: 6,
    plan: (word, i, rng) =>
      i === 0
        ? [key(rng, "x"), key(rng, "Backspace"), ...typeText(rng, word)]
        : clean(word, i, rng),
  },
  {
    name: "words-10-stop-on-letter",
    description: "stop on error letter, blocked wrong letters",
    config: { mode: "words", words: 10, stopOnError: "letter" },
    seed: 7,
    plan: (word, i, rng) => {
      if (i % 3 === 1) {
        return [
          ...typeText(rng, word.slice(0, 1)),
          key(rng, "z"),
          key(rng, "z"),
          ...typeText(rng, word.slice(1)),
        ];
      }
      return typeText(rng, word);
    },
  },
  {
    name: "words-10-punctuation-numbers",
    description: "words 10 with punctuation and numbers",
    config: { mode: "words", words: 10, punctuation: true, numbers: true },
    seed: 8,
    plan: clean,
  },
];

const zenActions = (rng: Rng): Action[] => [
  ...typeText(rng, "hello there "),
  ...typeText(rng, "zen"),
  key(rng, "Enter"),
  ...typeText(rng, "moed"),
  key(rng, "Backspace"),
  key(rng, "Backspace"),
  ...typeText(rng, "de rocks"),
  key(rng, "Shift+Enter"),
];

function toPlaywrightKey(k: string): string {
  if (k === " ") return "Space";
  if (k === "\n") return "Enter";
  if (k === "\t") return "Tab";
  return k;
}

async function perform(page: Page, actions: Action[]): Promise<void> {
  // expand into a down/up timeline so holds can overlap the next key
  type Step = { at: number; type: "down" | "up"; key: string };
  const steps: Step[] = [];
  let t = 0;
  for (const action of actions) {
    if (action.kind === "pause") {
      t += action.ms;
      continue;
    }
    t += action.gap;
    const parts =
      action.key === "+" ? ["+"] : toPlaywrightKey(action.key).split("+");
    const main = parts.pop() as string;
    // modifiers are pressed and released around the main key without overlap
    for (const mod of parts) steps.push({ at: t - 5, type: "down", key: mod });
    steps.push({ at: t, type: "down", key: main });
    const upAt = parts.length > 0 ? t + 20 : t + action.hold;
    steps.push({ at: upAt, type: "up", key: main });
    for (const mod of parts) {
      steps.push({ at: upAt + 5, type: "up", key: mod });
    }
    if (parts.length > 0) t = upAt + 10;
  }
  steps.sort((a, b) => a.at - b.at);

  const start = Date.now();
  const pressed = new Set<string>();
  for (const step of steps) {
    const wait = start + step.at - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
    if (step.type === "down") {
      // a key cannot be pressed twice - release the previous press first
      if (pressed.has(step.key)) await page.keyboard.up(step.key);
      pressed.add(step.key);
      await page.keyboard.down(step.key);
    } else if (pressed.has(step.key)) {
      pressed.delete(step.key);
      await page.keyboard.up(step.key);
    }
  }
}

async function getTargetWords(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          currentEventLog: () => { context: { targetWords: string[] } };
        }
      ).currentEventLog().context.targetWords,
  );
}

async function record(
  baseUrl: string,
  scenario: Scenario,
  outDir: string,
): Promise<void> {
  const { CHROME: executablePath } = process.env;
  const browser = await chromium.launch(
    executablePath !== undefined ? { executablePath } : {},
  );
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
  });

  const captured: { completedEvent: unknown } = { completedEvent: null };
  page.on("console", (msg) => {
    if (!msg.text().includes("Completed event object")) return;
    const last = msg.args()[msg.args().length - 1];
    void last?.jsonValue().then((value: unknown) => {
      captured.completedEvent = value;
    });
  });

  await page.goto(baseUrl);
  await page.evaluate(
    ({ config, customText }) => {
      localStorage.setItem("config", JSON.stringify(config));
      if (customText !== undefined) {
        localStorage.setItem("customTextSettings", JSON.stringify(customText));
      }
      localStorage.setItem(
        "acceptedCookies",
        JSON.stringify({ security: true, analytics: false, sentry: false }),
      );
    },
    { config: scenario.config, customText: scenario.customText },
  );
  await page.goto(baseUrl);
  await page.waitForSelector("#words .word");
  await page.waitForTimeout(1500);
  await page.focus("#wordsInput");

  const rng = mulberry32(scenario.seed);
  const keystrokes: Action[] = [];

  if (scenario.name === "zen") {
    const actions = zenActions(rng);
    keystrokes.push(...actions);
    await perform(page, actions);
  } else {
    const maxWords = scenario.maxWords ?? 100;
    for (let i = 0; i < maxWords && captured.completedEvent === null; i++) {
      const words = await getTargetWords(page);
      const word = words[i];
      if (word === undefined) {
        break;
      }
      const actions = scenario.plan(word, i, rng);
      keystrokes.push(...actions);
      await perform(page, actions);
      if (
        await page
          .locator("#result")
          .isVisible()
          .catch(() => false)
      ) {
        break;
      }
    }
  }

  for (let i = 0; i < 100 && captured.completedEvent === null; i++) {
    await page.waitForTimeout(100);
  }
  if (captured.completedEvent === null) {
    throw new Error(`${scenario.name}: test did not finish`);
  }

  const eventLog = await page.evaluate(() =>
    (window as unknown as { lastEventLog: () => unknown }).lastEventLog(),
  );
  const config = await page.evaluate(
    (keys) => {
      const c = (window as unknown as { config: Record<string, unknown> })
        .config;
      return Object.fromEntries(keys.map((k) => [k, c[k]]));
    },
    [
      "mode",
      "time",
      "words",
      "language",
      "punctuation",
      "numbers",
      "lazyMode",
      "funbox",
      "difficulty",
      "blindMode",
      "stopOnError",
      "confidenceMode",
      "freedomMode",
      "strictSpace",
      "quickEnd",
      "deleteOnError",
      "oppositeShiftMode",
      "britishEnglish",
      "quoteLength",
    ],
  );

  const fixture = {
    name: scenario.name,
    description: scenario.description,
    recordedWith: "web",
    config,
    customText: scenario.customText,
    keystrokes,
    eventLog,
    completedEvent: captured.completedEvent,
  };
  writeFileSync(
    join(outDir, `${scenario.name}.json`),
    `${JSON.stringify(fixture, null, 2)}\n`,
  );
  console.log(`recorded ${scenario.name}`);
  await browser.close();
}

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "../__fixtures__/keystrokes");
mkdirSync(outDir, { recursive: true });

const [url = "http://localhost:3000", ...names] = process.argv.slice(2);
for (const scenario of scenarios) {
  if (names.length > 0 && !names.includes(scenario.name)) continue;
  await record(url, scenario, outDir);
}
