import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import picomatch from "picomatch";
import { describe, expect, it } from "vite-plus/test";
import { parse } from "yaml";

const workflow = parse(
  readFileSync(
    new URL("../../../.github/workflows/oxytype-ci.yml", import.meta.url),
    "utf8",
  ),
);
const steps = workflow.jobs.changes.steps;
const filterStep = steps.find((step) => step.id === "filter");
const filters = parse(filterStep.with.filters);
const select = steps.find((step) => step.id === "select").run;
const jobs = Object.keys(workflow.jobs.changes.outputs);

// dorny/paths-filter's some-with-excludes: any pattern matches, no exclusion does.
function matches(file, patterns) {
  const test = (pattern) => picomatch(pattern, { dot: true })(file);
  const excludes = patterns.filter((pattern) => pattern.startsWith("!"));
  return (
    patterns.some((pattern) => !pattern.startsWith("!") && test(pattern)) &&
    !excludes.some((pattern) => test(pattern.slice(1)))
  );
}

function selected(files, { full = false } = {}) {
  const changed = Object.entries(filters)
    .filter(([, patterns]) => files.some((file) => matches(file, patterns)))
    .map(([name]) => name);
  const directory = mkdtempSync(join(tmpdir(), "oxytype-ci-routing-"));
  const output = join(directory, "outputs");
  try {
    execFileSync("bash", ["-e"], {
      input: select,
      env: {
        ...process.env,
        GITHUB_OUTPUT: output,
        FULL: String(full),
        CHANGED: JSON.stringify(changed),
      },
      stdio: ["pipe", "ignore", "inherit"],
    });
    const flags = Object.fromEntries(
      readFileSync(output, "utf8")
        .trim()
        .split("\n")
        .map((line) => line.split("=")),
    );
    return jobs.filter((job) => flags[job] === "true");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const allJobs = [
  "backend-lint",
  "backend-test",
  "frontend-lint",
  "frontend-test",
  "start-ssr",
  "start-browser",
  "start-updates",
  "start-delivery",
  "packages",
  "assets",
  "code",
  "engine",
];
const appJobs = [
  "backend-test",
  "frontend-lint",
  "frontend-test",
  "start-ssr",
  "start-browser",
  "start-updates",
  "start-delivery",
  "code",
];

it("matches dorny/paths-filter's quantifier", () => {
  expect(filterStep.with["predicate-quantifier"]).toBe("some-with-excludes");
});

it("exports a flag for every job", () => {
  expect(jobs.toSorted()).toEqual(allJobs.toSorted());
});

it.each([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  ".nvmrc",
  ".node-version",
  "patches/dependency.patch",
  "packages/typescript-config/base.json",
  ".github/actions/setup/action.yml",
  ".github/workflows/oxytype-ci.yml",
  ".github/workflows/production-release.yml",
])("runs every job for shared input %s", (file) => {
  expect(selected([file])).toEqual(allJobs);
});

it("runs every job outside pull requests", () => {
  // A main push's diff misses commits whose CI a newer push cancelled.
  expect(steps.find((step) => step.id === "select").env.FULL).toContain(
    "github.event_name != 'pull_request'",
  );
  expect(filterStep.if).toBe("github.event_name == 'pull_request'");
});

it("runs every job for force-full-ci and main or manual runs", () => {
  expect(selected([], { full: true })).toEqual(allJobs);
});

it.each([
  "Cargo.toml",
  "Cargo.lock",
  "rust-toolchain.toml",
  "crates/typing-engine/src/session.rs",
  "crates/typing-engine-wasm/src/lib.rs",
  "packages/typing-engine/src/browser.client.ts",
  "packages/typing-fixtures/commands/finite-edit.json",
  "packages/typing-fixtures/reference/words/english.json",
  "scripts/engine.ts",
])("runs native, Wasm, parity and Cloudflare consumers for %s", (file) => {
  expect(selected([file])).toEqual(allJobs);
});

it.each([
  "README.md",
  "docs/CI.md",
  "frontend/README.md",
  "LICENSE",
  ".github/labeler.yml",
  ".github/ISSUE_TEMPLATE/bug_report.yaml",
])("runs only the format check for %s", (file) => {
  expect(selected([file])).toEqual([]);
});

describe("application sources", () => {
  it("rebuilds the frontend, Start and inventory spec for frontend source", () => {
    expect(selected(["frontend/src/ts/test/result.ts"])).toEqual(appJobs);
  });

  it("treats non-script frontend config as source", () => {
    expect(selected(["frontend/wrangler.production.json"])).toEqual(appJobs);
    expect(selected(["frontend/tsconfig.json"])).toEqual(appJobs);
  });

  it("lints styles and rebuilds for frontend CSS", () => {
    expect(selected(["frontend/src/styles/tailwind.css"])).toEqual(
      appJobs.toSpliced(-1, 0, "assets"),
    );
  });

  it("rebuilds the application Worker when backend services change", () => {
    expect(selected(["backend/src/services/operations/results.ts"])).toEqual([
      "backend-lint",
      ...appJobs,
    ]);
  });

  it("runs every job for bundled package sources", () => {
    expect(selected(["packages/schemas/src/results.ts"])).toEqual(allJobs);
  });
});

describe("test-only changes", () => {
  it.each([
    [
      "frontend/__tests__/utils/format.spec.ts",
      ["frontend-lint", "frontend-test"],
    ],
    [
      "frontend/__tests__/start/workerd.ts",
      [
        "frontend-lint",
        "frontend-test",
        "start-ssr",
        "start-browser",
        "start-updates",
      ],
    ],
    ["frontend/start-e2e/auth.spec.ts", ["frontend-lint", "start-browser"]],
    ["frontend/e2e/typing.spec.ts", ["frontend-lint", "start-browser"]],
    [
      "frontend/update-e2e/deployment.spec.ts",
      ["frontend-lint", "start-updates"],
    ],
    ["backend/__tests__/d1/users.spec.ts", ["backend-lint", "backend-test"]],
    ["packages/schemas/__tests__/results.spec.ts", ["packages"]],
    ["packages/funbox/__test__/list.spec.ts", ["packages"]],
  ])("%s runs only its own suite", (file, expected) => {
    expect(selected([file])).toEqual([...expected, "code"]);
  });

  it.each([
    "backend/__tests__/d1/result-support.ts",
    "backend/__tests__/__testData__/completed-event.ts",
  ])("runs frontend suites importing backend helper %s", (file) => {
    expect(selected([file])).toEqual([
      "backend-lint",
      "backend-test",
      "frontend-lint",
      "frontend-test",
      "start-ssr",
      "code",
    ]);
  });

  it("runs the update suite for shared browser fixtures", () => {
    expect(selected(["frontend/start-e2e/fixtures.ts"])).toEqual([
      "frontend-lint",
      "start-browser",
      "start-updates",
      "code",
    ]);
  });
});

describe("static files", () => {
  it("runs the Start suites for Worker delivery files", () => {
    expect(selected(["frontend/static/_headers"])).toEqual([
      "start-ssr",
      "start-browser",
      "start-updates",
      "start-delivery",
      "assets",
    ]);
  });

  it("runs layout consumers for layout files", () => {
    expect(selected(["frontend/static/layouts/qwerty.json"])).toEqual([
      "frontend-test",
      "packages",
      "assets",
    ]);
  });

  it.each([
    "frontend/scripts/json-lint.ts",
    "frontend/scripts/short-quotes.json",
  ])("validates assets when validator input %s changes", (file) => {
    expect(selected([file])).toContain("assets");
  });

  it("validates assets when the constants they must match change", () => {
    expect(selected(["frontend/src/ts/constants/fonts.ts"])).toEqual(
      appJobs.toSpliced(-1, 0, "assets"),
    );
  });

  it("runs the challenge catalog test for challenge files", () => {
    expect(selected(["frontend/static/challenges/list.json"])).toEqual([
      "packages",
      "assets",
    ]);
  });
});

it.each([
  ["packages/release/src/production-validation.js", ["packages", "code"]],
  [
    "packages/oxlint-config/config.ts",
    ["backend-lint", "frontend-lint", "packages", "code"],
  ],
  ["vite.config.ts", ["backend-lint", "frontend-lint", "packages", "code"]],
  ["frontend/storybook/stories/button.tsx", ["frontend-lint", "code"]],
  ["knip.ts", ["code"]],
  ["frontend/static/quotes/english.json", ["assets"]],
  ["frontend/static/themes/serika.css", ["assets"]],
  ["stylelint.config.mjs", ["assets", "code"]],
])("routes %s narrowly", (file, expected) => {
  expect(selected([file])).toEqual(expected);
});

it("builds the production Worker once and shares it with SSR and browser shards", () => {
  const build = workflow.jobs["start-build"];
  for (const flag of ["start-ssr", "start-browser"]) {
    expect(build.if).toContain(`needs.changes.outputs.${flag} == 'true'`);
  }
  const upload = build.steps.find((step) =>
    step.uses?.startsWith("actions/upload-artifact@"),
  );
  expect(upload.with).toMatchObject({
    name: "start-worker",
    path: "frontend/dist/start",
    "include-hidden-files": true,
    "if-no-files-found": "error",
  });
  for (const name of ["start-ssr", "start-browser"]) {
    const job = workflow.jobs[name];
    expect(job.needs).toContain("start-build");
    const download = job.steps.find((step) =>
      step.uses?.startsWith("actions/download-artifact@"),
    );
    expect(download.with).toMatchObject({
      name: upload.with.name,
      path: upload.with.path,
    });
    expect(
      job.steps.some((step) => /build:start(?:$|\s)/.test(step.run ?? "")),
    ).toBe(false);
  }
  expect(workflow.jobs["ci-ok"].needs).toContain("start-build");
});
