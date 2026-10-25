import { readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import {
  calibrate,
  extractSamples,
  type TimingSample,
} from "../src/anticheat/calibration";
import { calibrateDetectors } from "../src/anticheat/detectors";

const USAGE = `Usage: vp run anticheat:calibrate [<label>=<file.json|dir> ...]

Runs every timing detector over labelled samples and prints per-label rates,
false positive rates (labels starting with "human") and false negative rates
(labels starting with "bot"), plus review feature spreads.

Files may be an /admin/anticheat/audits?event=anticheat_sample response, audit
rows, arrays of { keySpacing, keyDuration }, recorded fixtures
(completedEvent/result) or calibration fixtures ({ label, client, samples }).
A directory loads every .json file in it. Without arguments, the committed
recordings and synthetic fixtures are used.`;

const root = resolve(import.meta.dirname, "../..");
const DEFAULT_SETS: [string, string][] = [
  // scripted Playwright input against the real web client, not human typing
  ["recorded-web", "packages/typing-fixtures/reference/keystrokes"],
  // label comes from each file: bot or model
  ["", "packages/typing-fixtures/reference/anticheat"],
];

async function files(path: string): Promise<string[]> {
  if (!path.endsWith(".json")) {
    const names = await readdir(path);
    return names
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => join(path, name));
  }
  return [path];
}

async function load(
  label: string,
  path: string,
  into: Map<string, TimingSample[]>,
): Promise<void> {
  for (const file of await files(path)) {
    const input = JSON.parse(await readFile(file, "utf8")) as unknown;
    const fileLabel =
      label !== ""
        ? label
        : typeof input === "object" && input !== null && "label" in input
          ? String(input.label)
          : basename(file, ".json");
    // each file is one user's history, so replays only match within a file
    into.set(`${fileLabel}:${resolve(file)}`, extractSamples(input));
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => !arg.includes("="))) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  const sets: [string, string][] =
    args.length > 0
      ? args.map((arg) => {
          const [label = "", path = ""] = arg.split(/=(.*)/s);
          return [label, path];
        })
      : DEFAULT_SETS.map(([label, path]) => [label, join(root, path)]);

  const histories = new Map<string, TimingSample[]>();
  for (const [label, path] of sets) await load(label, path, histories);

  // detectors see each file as one user; reports group by label
  const byLabel = new Map<string, TimingSample[]>();
  for (const [key, samples] of histories) {
    const label = key.slice(0, key.indexOf(":"));
    for (const sample of samples) {
      const ownLabel = sample.label ?? label;
      byLabel.set(ownLabel, [...(byLabel.get(ownLabel) ?? []), sample]);
    }
  }
  const report = {
    detectors: calibrateDetectors(histories, (key) =>
      key.slice(0, key.indexOf(":")),
    ),
    review: Object.fromEntries(
      [...byLabel].map(([label, samples]) => [label, calibrate(samples)]),
    ),
  };
  console.log(JSON.stringify(report, null, 2));
}
void main();
