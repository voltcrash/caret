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
    "${{ github.sha }}-${{ github.run_id }}-${{ github.run_attempt }}",
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

it("retires consumers on direct deployments while keeping dry-runs read-only", () => {
  const { scripts } = JSON.parse(
    readFileSync(
      new URL("../../../frontend/package.json", import.meta.url),
      "utf8",
    ),
  );
  for (const environment of ["production", "staging"]) {
    expect(scripts[`deploy:${environment}-site`]).toBe(
      `vp run check:${environment} && vp run retire:${environment}-task-consumer && wrangler deploy --config dist/start/server/wrangler.json --secrets-file .dev.vars.${environment}`,
    );
    expect(scripts[`retire:${environment}-task-consumer`]).toBe(
      `tsx scripts/retire-task-consumer.ts ${environment}`,
    );
  }
  expect(scripts["deploy:production-dry-run"]).not.toContain("retire:");
  expect(scripts["dry-run:start"]).not.toContain("retire:");
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
