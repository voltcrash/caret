import { readFileSync } from "node:fs";
import { expect, it } from "vite-plus/test";
import { parse } from "yaml";

const workflow = parse(
  readFileSync(
    new URL(
      "../../../.github/workflows/production-release.yml",
      import.meta.url,
    ),
    "utf8",
  ),
);

it("deploys every manual main snapshot without creating a release or version", () => {
  expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
  expect(workflow.permissions).toEqual({ contents: "read", actions: "read" });
  expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
  const job = workflow.jobs.deploy;
  expect(job.if).toBe(
    "github.repository == 'voltcrash/oxytype' && github.ref == 'refs/heads/main'",
  );
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
    "requireSuccessfulProductionCI({ github, context, sha: context.sha })",
  );
  expect(steps[0].with.ref).toBe("${{ github.sha }}");
  const settings = index("Prepare production credentials and build settings");
  const build = index("Build production frontend and Worker");
  const check = index("Check production deployment");
  const migrate = index("Apply production D1 migrations");
  const deploy = index("Deploy production with Wrangler");
  expect(settings).toBeGreaterThan(validation);
  expect(build).toBeGreaterThan(settings);
  expect(check).toBeGreaterThan(build);
  expect(migrate).toBeGreaterThan(check);
  expect(deploy).toBeGreaterThan(migrate);
  expect(steps[build].env.OXYTYPE_BUILD_ID).toBe(
    "${{ github.sha }}-${{ github.run_id }}-${{ github.run_attempt }}",
  );
  expect(steps[deploy].run).toContain(
    "--filter @oxytype/frontend deploy:production-site",
  );
});
