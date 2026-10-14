import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Loads the keystroke fixtures recorded from the web (scripts/record-fixtures.ts)
// together with the frontend output snapshot for each of them
// (frontend/__tests__/test/typing-core-parity.spec.ts).

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../__fixtures__/keystrokes",
);

type FixtureKeystroke =
  | { kind: "key"; key: string; gap: number; hold: number }
  | { kind: "pause"; ms: number };

type KeystrokeFixture = {
  name: string;
  description: string;
  recordedWith: "web";
  config: Record<string, unknown> & { mode: string };
  customText?: Record<string, unknown>;
  keystrokes: FixtureKeystroke[];
  eventLog: {
    version: number;
    events: { type: string; testMs: number; data: Record<string, unknown> }[];
    context: { targetWords: string[]; mode: string; mode2: string };
  };
  completedEvent: Record<string, unknown>;
};

type ParitySnapshot = {
  completedEvent: Record<string, unknown>;
  hash: string;
  derived: {
    inputHistory: string[];
    missedWords: Record<string, number>;
    wordBurstHistory: (number | null)[];
    correctedWordsHistory: string[];
    rawHistory: number[];
    keypressesPerSecond: number[];
    incompleteTestSeconds: number;
  };
};

export type ParityCase = {
  name: string;
  fixture: KeystrokeFixture;
  snapshot: ParitySnapshot | undefined;
};

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8")) as unknown;
}

/**
 * Round trips through JSON, the same way the snapshots were written.
 * Drops undefined fields and turns non finite numbers into null.
 */
export function asJsonData(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

export function loadParityCases(): ParityCase[] {
  return readdirSync(FIXTURES_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const fixture = readJson(join(FIXTURES_DIR, file)) as KeystrokeFixture;
      const snapshotPath = join(FIXTURES_DIR, "__snapshots__", file);
      return {
        name: fixture.name,
        fixture,
        snapshot: existsSync(snapshotPath)
          ? (readJson(snapshotPath) as ParitySnapshot)
          : undefined,
      };
    });
}
