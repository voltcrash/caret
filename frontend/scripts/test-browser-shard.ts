import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { balanceBrowserFiles } from "./browser-shards";

const root = resolve(import.meta.dirname, "..");
const [index, count] = (process.argv[2] ?? "").split("/").map(Number);
if (
  index === undefined ||
  count === undefined ||
  !Number.isInteger(index) ||
  index < 1 ||
  index > count
) {
  throw new Error("Usage: test-browser-shard.ts index/count [--list]");
}
const args = [
  "exec",
  "playwright",
  "test",
  "--config",
  "playwright.start.config.ts",
];
const listed = spawnSync("vp", [...args, "--list", "--reporter=json"], {
  cwd: root,
  encoding: "utf8",
});
if (listed.error) throw listed.error;
if (listed.status !== 0) {
  process.stderr.write(listed.stderr + listed.stdout);
  process.exit(listed.status ?? 1);
}
type Suite = {
  file: string;
  specs: { tests: { projectName: string }[] }[];
  suites?: Suite[];
};
const report = JSON.parse(listed.stdout) as { suites: Suite[] };
function files(suites: Suite[]): string[] {
  return suites.flatMap((suite) => [
    ...suite.specs.flatMap((spec) =>
      spec.tests.map((test) => `[${test.projectName}] > ${suite.file}`),
    ),
    ...files(suite.suites ?? []),
  ]);
}
const durations = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "browser-durations.json"), "utf8"),
) as Record<string, number>;
const shards = balanceBrowserFiles(files(report.suites), durations, count);
for (const [number, shard] of shards.entries()) {
  console.log(
    `Shard ${number + 1}/${count}: ${shard.files.length} files, ~${shard.seconds.toFixed(1)}s`,
  );
}
const selected = shards[index - 1];
if (selected === undefined || selected.files.length === 0) {
  throw new Error("Empty browser shard");
}
mkdirSync(resolve(root, ".reports"), { recursive: true });
const list = resolve(root, `.reports/browser-shard-${index}.txt`);
writeFileSync(list, `${selected.files.join("\n")}\n`);
const result = spawnSync(
  "vp",
  [...args, "--test-list", list, ...process.argv.slice(3)],
  { cwd: root, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
