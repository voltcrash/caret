import type { TestEventNoMs } from "@oxytype/web-shared/events/types";

import type { Audit } from "@oxytype/typing-engine/audit";

export type ScatterPoint = { x: number; y: number };

export type InsertKeystroke = { testMs: number; charIndex: number };

const KEY_ORDER = [
  "Backquote",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
  "Digit7",
  "Digit8",
  "Digit9",
  "Digit0",
  "Minus",
  "Equal",
  "Tab",
  "KeyQ",
  "KeyW",
  "KeyE",
  "KeyR",
  "KeyT",
  "KeyY",
  "KeyU",
  "KeyI",
  "KeyO",
  "KeyP",
  "BracketLeft",
  "BracketRight",
  "Backslash",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyF",
  "KeyG",
  "KeyH",
  "KeyJ",
  "KeyK",
  "KeyL",
  "Semicolon",
  "Quote",
  "IntlBackslash",
  "KeyZ",
  "KeyX",
  "KeyC",
  "KeyV",
  "KeyB",
  "KeyN",
  "KeyM",
  "Comma",
  "Period",
  "Slash",
  "Space",
  "Enter",
];

const KEY_LABELS: Record<string, string> = {
  Space: "␣",
  Enter: "⏎",
  Tab: "⇥",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Semicolon: ";",
  Quote: "'",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  IntlBackslash: "\\",
  Minus: "-",
  Equal: "=",
  Backquote: "`",
};

export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return KEY_LABELS[code] ?? code;
}

export function percentileOf(values: number[], p: number): number {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.max(sorted[Math.floor(p * (sorted.length - 1))] as number, 1);
}

export function getKeydownCodes(events: TestEventNoMs[]): string[] {
  const codes: string[] = [];
  for (const event of events) {
    if (event.type === "keydown") codes.push(event.data.code);
  }
  return codes;
}

/**
 * Real keystrokes only - automatic inputs (delete on error, auto indent) have
 * no keypress behind them and reuse the triggering keystroke's timestamp.
 */
export function getInsertKeystrokes(
  events: TestEventNoMs[],
): InsertKeystroke[] {
  const list: InsertKeystroke[] = [];
  for (const event of events) {
    if (
      event.type === "input" &&
      event.data.inputType.startsWith("insert") &&
      event.data.automatic !== true
    ) {
      list.push({ testMs: event.testMs, charIndex: event.data.charIndex });
    }
  }
  return list;
}

/** each gap against the one after it */
export function getLagPoints(spacing: number[]): ScatterPoint[] {
  const points: ScatterPoint[] = [];
  for (let i = 0; i + 1 < spacing.length; i++) {
    points.push({
      x: spacing[i] as number,
      y: spacing[i + 1] as number,
    });
  }
  return points;
}

export function getIndexPoints(spacing: number[]): ScatterPoint[] {
  return spacing.map((value, i) => ({ x: i, y: value }));
}

/** gap to the next key against the hold, skipping unreleased keys */
export function getHoldFlightPoints(
  spacing: number[],
  durations: number[],
): ScatterPoint[] {
  const points: ScatterPoint[] = [];
  for (let i = 0; i < spacing.length; i++) {
    const hold = durations[i];
    if (hold === undefined || hold <= 0) continue;
    points.push({ x: spacing[i] as number, y: hold });
  }
  return points;
}

/**
 * One column per physical key. Takes the values rather than reading holds
 * directly, because both arrays are indexed by keypress: durations[i] is the
 * hold of key i and spacing[i] is the gap that follows it, so the same
 * grouping works for either.
 */
export function getPerKeyPoints(
  values: number[],
  codes: string[],
): { labels: string[]; points: ScatterPoint[] } {
  const byCode = new Map<string, number[]>();
  for (let i = 0; i < codes.length; i++) {
    const value = values[i];
    const code = codes[i];
    if (value === undefined || value <= 0 || code === undefined) continue;
    const list = byCode.get(code) ?? [];
    list.push(value);
    byCode.set(code, list);
  }
  const columns = [...byCode.keys()]
    .filter((code) => (byCode.get(code) as number[]).length >= 3)
    .sort((a, b) => {
      const ai = KEY_ORDER.indexOf(a);
      const bi = KEY_ORDER.indexOf(b);
      return (
        (ai === -1 ? KEY_ORDER.length : ai) -
        (bi === -1 ? KEY_ORDER.length : bi)
      );
    });
  const points: ScatterPoint[] = [];
  columns.forEach((code, columnIndex) => {
    (byCode.get(code) as number[]).forEach((value, occurrence) => {
      // deterministic spread so repeats on the same key do not stack into one
      // dot and hide how wide that key's spread is
      points.push({
        x: columnIndex + ((occurrence % 5) - 2) * 0.07,
        y: value,
      });
    });
  });
  return { labels: columns.map(keyLabel), points };
}

/**
 * The lognormal being compared against, fitted straight from the log mean and
 * log spread of the sample. Sigma comes back with the points because it is
 * the parameter of this fit - it belongs on this chart as context, not in the
 * stat row where it reads as a verdict. probit (Acklam's inverse normal CDF)
 * places the theoretical quantiles on the Q-Q plot.
 */
export function getLognormalFit(
  spacing: number[],
  audit: Audit,
): {
  points: ScatterPoint[];
  sigma: number | null;
} {
  const values = spacing.filter((v) => v > 0).sort((a, b) => a - b);
  if (values.length < 5) return { points: [], sigma: null };
  const logs = values.map((v) => Math.log(v));
  const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
  const sigma = Math.sqrt(
    logs.reduce((a, b) => a + (b - mean) ** 2, 0) / logs.length,
  );
  const quantiles = audit.probit(
    values.map((_, i) => (i + 0.5) / values.length),
  );
  return {
    points: values.map((value, i) => ({
      x: Math.exp(mean + sigma * (quantiles[i] as number)),
      y: value,
    })),
    sigma,
  };
}

/** time to type each character against its position in the word */
export function getCharPositionPoints(
  inserts: InsertKeystroke[],
): ScatterPoint[] {
  const points: ScatterPoint[] = [];
  for (let i = 1; i < inserts.length; i++) {
    const previous = inserts[i - 1] as InsertKeystroke;
    const current = inserts[i] as InsertKeystroke;
    points.push({
      x: current.charIndex,
      y: current.testMs - previous.testMs,
    });
  }
  return points;
}
