import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, matchesGlob } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, it } from "vite-plus/test";
import { parse } from "yaml";

const workflow = parse(
  readFileSync(
    new URL("../../../.github/workflows/oxytype-ci.yml", import.meta.url),
    "utf8",
  ),
);
const steps = workflow.jobs["pre-ci"].steps;
const filters = parse(steps.find((step) => step.id === "filter").with.filters);
const exports = steps.find((step) => step.id === "export-changes").run;

function changes(files) {
  const flags = Object.fromEntries(
    Object.entries(filters).map(([name, patterns]) => [
      name,
      files.some((file) =>
        patterns.some((pattern) => matchesGlob(file, pattern)),
      )
        ? "true"
        : "false",
    ]),
  );
  const script = exports.replace(
    /\$\{\{([\s\S]*?)\}\}/g,
    (_match, expression) =>
      String(
        runInNewContext(
          expression.replace(
            /steps\.filter\.outputs\.([\w-]+)/g,
            (_output, name) => JSON.stringify(flags[name]),
          ),
          {},
          { timeout: 1000 },
        ),
      ),
  );
  const directory = mkdtempSync(join(tmpdir(), "oxytype-ci-routing-"));
  const output = join(directory, "outputs");
  try {
    execFileSync("bash", ["-e"], {
      input: script,
      env: { ...process.env, GITHUB_OUTPUT: output },
    });
    return Object.fromEntries(
      readFileSync(output, "utf8")
        .trim()
        .split("\n")
        .map((line) => line.split("=")),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

it.each([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "vite.config.ts",
  "vitest.config.ts",
  ".github/workflows/oxytype-ci.yml",
  "patches/dependency.patch",
  "stylelint.config.mjs",
  ".oxfmtrc-editor.json",
  ".nvmrc",
])("validates all components for shared input %s", (file) => {
  const flags = changes([file]);
  for (const name of [
    "should-build-be",
    "should-build-fe",
    "should-build-pkg",
    "should-build-tui",
    "assets-or-styles",
  ]) {
    expect(flags[name], name).toBe("true");
  }
});

it("retains selective routing for frontend source changes", () => {
  expect(changes(["frontend/src/ts/test/result.ts"])).toMatchObject({
    "should-build-fe": "true",
    "should-build-be": "false",
    "should-build-pkg": "false",
    "should-build-tui": "false",
  });
});

it("rebuilds the application Worker when backend services change", () => {
  expect(changes(["backend/src/services/operations/results.ts"])).toMatchObject(
    {
      "should-build-fe": "true",
      "should-build-be": "true",
      "should-build-tui": "false",
    },
  );
});
