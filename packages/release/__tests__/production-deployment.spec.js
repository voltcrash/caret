import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { runInNewContext } from "node:vm";
import { expect, it } from "vite-plus/test";
import { parse } from "yaml";
import { requireSuccessfulProductionCI } from "../src/production-validation.js";

const workflow = parse(
  readFileSync(
    new URL(
      "../../../.github/workflows/production-release.yml",
      import.meta.url,
    ),
    "utf8",
  ),
);

const successfulCI = {
  event: "push",
  head_branch: "main",
  head_repository: { full_name: "voltcrash/oxytype" },
  conclusion: "success",
};

it.each([
  { name: "successful main push", allowed: true },
  { name: "failed CI", run: { conclusion: "failure" }, allowed: false },
  { name: "cancelled CI", run: { conclusion: "cancelled" }, allowed: false },
  { name: "skipped CI", run: { conclusion: "skipped" }, allowed: false },
  { name: "neutral CI", run: { conclusion: "neutral" }, allowed: false },
  { name: "timed out CI", run: { conclusion: "timed_out" }, allowed: false },
  { name: "pending CI", run: { conclusion: null }, allowed: false },
  { name: "pull request CI", run: { event: "pull_request" }, allowed: false },
  { name: "other branch", run: { head_branch: "feature" }, allowed: false },
  {
    name: "fork main CI",
    run: { head_repository: { full_name: "fork/oxytype" } },
    allowed: false,
  },
  { name: "fork repository", repository: "fork/oxytype", allowed: false },
  { name: "unsequenced push", event: "push", allowed: false },
  { name: "manual main retry", event: "workflow_dispatch", allowed: true },
  {
    name: "manual feature dispatch",
    event: "workflow_dispatch",
    ref: "refs/heads/feature",
    allowed: false,
  },
])("gates production deployment: $name", ({ allowed, ...scenario }) => {
  // These conditions use only the equality/boolean subset shared by Actions and JS.
  const github = {
    repository: scenario.repository ?? "voltcrash/oxytype",
    ref: scenario.ref ?? "refs/heads/main",
    event_name: scenario.event ?? "workflow_run",
    event: { workflow_run: { ...successfulCI, ...scenario.run } },
  };
  expect(runInNewContext(workflow.jobs.deploy.if, { github })).toBe(allowed);
});

it("deploys after main CI or manual retry without creating a release or version", () => {
  const ci = parse(
    readFileSync(
      new URL("../../../.github/workflows/oxytype-ci.yml", import.meta.url),
      "utf8",
    ),
  );
  expect(Object.keys(workflow.on)).toEqual([
    "workflow_run",
    "workflow_dispatch",
  ]);
  expect(workflow.on.workflow_run).toEqual({
    workflows: [ci.name],
    types: ["completed"],
    branches: ["main"],
  });
  expect(ci.on.push.branches).toContain("main");
  expect(workflow.permissions).toEqual({ contents: "read", actions: "read" });
  expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
  const job = workflow.jobs.deploy;
  expect(job.environment.name).toBe("production");
  for (const step of job.steps.slice(0, -1)) {
    expect(step.if, step.name).toBeUndefined();
  }
  expect(job.steps.at(-1).if).toBe("always()");
  const scripts = JSON.stringify(job.steps);
  for (const removed of [
    "shouldDeploy",
    "RELEASE_VERSION",
    "release.json",
    "production-release.js",
    "upload-artifact",
    "pkg.version",
  ]) {
    expect(scripts).not.toContain(removed);
  }
});

it("validates the exact deployment snapshot before building and applying migrations", () => {
  const steps = workflow.jobs.deploy.steps;
  const index = (name) => steps.findIndex((step) => step.name === name);
  const validation = steps.findIndex((step) => step.id === "validate-ci");
  expect(validation).toBeGreaterThan(0);
  expect(steps[validation].with.script).toContain(
    "requireSuccessfulProductionCI({ github, context, sha: process.env.DEPLOYMENT_SHA })",
  );
  expect(workflow.jobs.deploy.env.DEPLOYMENT_SHA).toBe(
    "${{ github.event_name == 'workflow_run' && github.event.workflow_run.head_sha || github.sha }}",
  );
  expect(steps[0].with.ref).toBe("${{ env.DEPLOYMENT_SHA }}");
  const settings = index("Prepare production credentials and build settings");
  const build = index("Build production frontend and Worker");
  const check = index("Check production deployment");
  const retire = index("Retire the removed production task consumer");
  const migrate = index("Apply production D1 migrations");
  const deploy = index("Deploy production with Wrangler");
  expect(settings).toBeGreaterThan(validation);
  expect(build).toBeGreaterThan(settings);
  expect(check).toBeGreaterThan(build);
  expect(retire).toBeGreaterThan(check);
  expect(migrate).toBeGreaterThan(retire);
  expect(deploy).toBeGreaterThan(migrate);
  expect(steps[build].env.OXYTYPE_BUILD_ID).toBe(
    "${{ env.DEPLOYMENT_SHA }}-${{ github.run_id }}-${{ github.run_attempt }}",
  );
  expect(steps[deploy].run).toContain(
    "--filter @oxytype/frontend deploy:production-site",
  );
  expect(steps[retire].env.CLOUDFLARE_API_TOKEN).toBe(
    "${{ secrets.CLOUDFLARE_API_TOKEN }}",
  );
  expect(steps[retire].run).toBe(
    "vp run --filter @oxytype/frontend retire:production-task-consumer",
  );
});

it.each(["workflow_run", "workflow_dispatch"])(
  "checks out, validates and labels the same commit for %s",
  async (eventName) => {
    const github = {
      event_name: eventName,
      sha: "current-main-sha",
      run_id: "100",
      run_attempt: "2",
      event:
        eventName === "workflow_run"
          ? { workflow_run: { ...successfulCI, head_sha: "ci-passed-sha" } }
          : {},
    };
    const expectedSha =
      eventName === "workflow_run" ? "ci-passed-sha" : "current-main-sha";
    const env = {};
    const resolve = (value) =>
      value.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, expression) =>
        runInNewContext(expression, { github, env }),
      );
    env.DEPLOYMENT_SHA = resolve(workflow.jobs.deploy.env.DEPLOYMENT_SHA);
    const checkout = workflow.jobs.deploy.steps[0];
    expect(resolve(checkout.with.ref)).toBe(expectedSha);
    const build = workflow.jobs.deploy.steps.find(
      (step) => step.name === "Build production frontend and Worker",
    );
    expect(resolve(build.env.OXYTYPE_BUILD_ID)).toBe(`${expectedSha}-100-2`);
    const run = {
      ...successfulCI,
      head_sha: expectedSha,
      status: "completed",
      id: 42,
    };
    expect(
      await requireSuccessfulProductionCI({
        github: {
          rest: {
            actions: {
              listWorkflowRuns: async (query) => {
                expect(query.head_sha).toBe(expectedSha);
                return { data: { workflow_runs: [run] } };
              },
            },
          },
        },
        context: {
          eventName,
          repo: { owner: "voltcrash", repo: "oxytype" },
          sha: github.sha,
          payload: github.event,
        },
        sha: env.DEPLOYMENT_SHA,
      }),
    ).toEqual(run);
  },
);

it("retires consumers and enables replicas on deployments while keeping dry-runs read-only", () => {
  const { scripts } = JSON.parse(
    readFileSync(
      new URL("../../../frontend/package.json", import.meta.url),
      "utf8",
    ),
  );
  for (const environment of ["production", "staging"]) {
    expect(scripts[`deploy:${environment}-site`]).toBe(
      `vp run check:${environment} && vp run retire:${environment}-task-consumer && vp run db:replication:${environment} && wrangler deploy --config dist/start/server/wrangler.json --secrets-file .dev.vars.${environment}`,
    );
    expect(scripts[`retire:${environment}-task-consumer`]).toBe(
      `vpx ./scripts/retire-task-consumer.ts ${environment}`,
    );
    expect(scripts[`db:replication:${environment}`]).toBe(
      `vpx ./scripts/enable-d1-read-replication.ts ${environment}`,
    );
  }
  expect(scripts["deploy:production-dry-run"]).not.toContain("retire:");
  expect(scripts["dry-run:start"]).not.toContain("retire:");
  expect(scripts["deploy:production-dry-run"]).not.toContain("db:replication:");
  expect(scripts["dry-run:start"]).not.toContain("db:replication:");
});

it.each(["", "ba_dashboard_workflow_fixture"])(
  "writes private deployment settings without changing package metadata (%s)",
  (apiKey) => {
    const settings = workflow.jobs.deploy.steps.find(
      (step) =>
        step.name === "Prepare production credentials and build settings",
    );
    expect(settings.env.BETTER_AUTH_API_KEY).toBe(
      "${{ secrets.BETTER_AUTH_API_KEY }}",
    );
    const script = settings.run.match(/<<'NODE'\n([\s\S]+)\nNODE/)?.[1];
    if (script === undefined) {
      throw new Error("Missing deployment settings script");
    }
    const directory = mkdtempSync(join(tmpdir(), "oxytype-deploy-settings-"));
    const manifest = '{"name":"fixture","private":true}\n';
    try {
      mkdirSync(join(directory, "frontend"));
      writeFileSync(join(directory, "package.json"), manifest);
      const frontend =
        "BACKEND_URL=/api\nTURNSTILE_SITE_KEY=public-fixture\nAUTH_PROVIDERS=github\n";
      execFileSync(process.execPath, ["--input-type=module"], {
        cwd: directory,
        input: script,
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: "cloudflare-fixture",
          PRODUCTION_BACKEND_ENV:
            "BETTER_AUTH_SECRET=auth-secret-fixture\nBETTER_AUTH_API_KEY=existing-dashboard-key\n",
          BETTER_AUTH_API_KEY: apiKey,
          PRODUCTION_FRONTEND_ENV: frontend,
        },
      });
      const backendPath = join(directory, "frontend/.dev.vars.production");
      const frontendPath = join(directory, "frontend/.env.production.local");
      const backend = parseEnv(readFileSync(backendPath, "utf8"));
      expect(backend.BETTER_AUTH_SECRET).toBe("auth-secret-fixture");
      expect(backend.BETTER_AUTH_API_KEY).toBe(
        apiKey || "existing-dashboard-key",
      );
      expect(statSync(backendPath).mode & 0o777).toBe(0o600);
      expect(statSync(frontendPath).mode & 0o777).toBe(0o600);
      expect(readFileSync(frontendPath, "utf8")).toBe(frontend);
      expect(readFileSync(join(directory, "package.json"), "utf8")).toBe(
        manifest,
      );
      expect(existsSync(join(directory, "frontend/static/release.json"))).toBe(
        false,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
