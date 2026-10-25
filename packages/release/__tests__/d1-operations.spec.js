import { readFileSync } from "node:fs";
import { expect, it } from "vite-plus/test";
import { parse } from "yaml";

const read = (path) =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
const frontend = JSON.parse(read("frontend/package.json")).scripts;
const backend = JSON.parse(read("backend/package.json")).scripts;

it("optimizes only after successful migrations on the same local or remote target", () => {
  for (const suffix of ["", ":staging", ":production"]) {
    expect(frontend[`db:migrate${suffix}`]).toContain(
      `&& vp run db:optimize${suffix}`,
    );
    const optimize = frontend[`db:optimize${suffix}`];
    expect(optimize).toContain("--command 'PRAGMA optimize'");
    if (suffix === "") {
      expect(optimize).toContain(
        "--local --persist-to ../backend/.wrangler/state",
      );
    } else {
      expect(optimize).toContain(
        `--remote --config wrangler.${suffix.slice(1)}.json`,
      );
    }
  }
  expect(backend["db:migrate"]).toContain("&& vp run db:optimize");
  expect(backend["db:optimize"]).toContain(
    "--local --command 'PRAGMA optimize'",
  );
  expect(frontend["deploy:production-dry-run"]).not.toContain("optimize");
});

it("collects daily Insights only on main, with no write permissions or deployment", () => {
  const workflow = parse(read(".github/workflows/d1-insights.yml"));
  expect(workflow.on.schedule).toEqual([{ cron: "23 6 * * *" }]);
  expect(Object.keys(workflow.on)).toEqual(["schedule", "workflow_dispatch"]);
  expect(workflow.permissions).toEqual({ contents: "read" });
  const job = workflow.jobs.report;
  expect(job.if).toContain("github.ref == 'refs/heads/main'");
  expect(job.strategy.matrix.target).toEqual(["production", "staging"]);
  expect(job.environment).toBe("production");
  const collect = job.steps.find(
    (step) => step.name === "Collect query metrics",
  );
  expect(collect.env.CLOUDFLARE_API_TOKEN).toBe(
    "${{ secrets.CLOUDFLARE_API_TOKEN }}",
  );
  expect(collect.run).toBe(
    "vp run --filter @oxytype/frontend db:insights:${{ matrix.target }}",
  );
  const artifact = job.steps.find(
    (step) => step.name === "Retain sanitized reports",
  );
  expect(artifact.with.path).toBe("frontend/.reports/d1/");
  expect(artifact.with["include-hidden-files"]).toBe(true);
  expect(artifact.with["retention-days"]).toBe(30);
  expect(JSON.stringify(job.steps)).not.toContain("deploy:");
});

it("enables Smart Placement directly in production without changing staging placement", () => {
  const staging = JSON.parse(read("frontend/wrangler.staging.json"));
  const production = JSON.parse(read("frontend/wrangler.production.json"));
  expect(staging.placement).toBeUndefined();
  expect(staging.vars.PLACEMENT_MODE).toBeUndefined();
  expect(production.placement).toEqual({ mode: "smart" });
  expect(production.vars.PLACEMENT_MODE).toBe("smart");
  for (const environment of ["staging", "production"]) {
    expect(frontend[`db:insights:${environment}`]).toBe(
      `tsx scripts/report-d1-insights.ts ${environment}`,
    );
  }
});
