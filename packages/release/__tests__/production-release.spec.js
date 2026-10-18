import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { parseEnv } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { parse } from "yaml";
import {
  prepareProductionRelease,
  publishProductionRelease,
} from "../src/production-release.js";

const marker = "<!-- oxytype-production-release -->";

describe("production releases", () => {
  let cwd;
  let github;
  let context;

  function git(...args) {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  }

  function commit(subject, date) {
    execFileSync("git", ["commit", "--quiet", "--allow-empty", "-m", subject], {
      cwd,
      env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    });
    context.sha = git("rev-parse", "HEAD");
    return context.sha;
  }

  function release(tag, publishedAt = "2026-10-04T00:17:00Z") {
    return {
      tag_name: tag,
      name: tag.slice(1),
      published_at: publishedAt,
      body: marker,
      draft: false,
      prerelease: false,
    };
  }

  /** Tags HEAD as the latest production release. */
  function previousRelease(tag = "v26.10.01", older = []) {
    git("tag", tag);
    github.paginate.mockResolvedValue([release(tag), ...older]);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T00:02:00Z"));
    cwd = mkdtempSync(join(tmpdir(), "oxytype-production-release-"));
    git("init", "--quiet", "--initial-branch=main");
    git("config", "user.name", "Release Tests");
    git("config", "user.email", "release-tests@example.com");
    git("config", "commit.gpgsign", "false");
    git("config", "tag.gpgsign", "false");
    context = {
      repo: { owner: "voltcrash", repo: "oxytype" },
      runId: 42,
      eventName: "workflow_dispatch",
      sha: "",
    };
    github = {
      paginate: vi.fn().mockResolvedValue([]),
      rest: {
        repos: {
          listReleases: vi.fn(),
          createRelease: vi
            .fn()
            .mockResolvedValue({ data: { name: "26.10.01" } }),
        },
      },
    };
    commit("old inherited history", "2026-10-03T12:00:00Z");
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(cwd, { recursive: true, force: true });
  });

  it("numbers the first release of a month .01, independent of the day", async () => {
    vi.setSystemTime(new Date("2026-10-08T01:00:00Z"));
    const plan = await prepareProductionRelease({ github, context, cwd });
    expect(plan.version).toBe("26.10.01");
    expect(plan.tag).toBe("v26.10.01");
    expect(plan.releaseHistory[0].published_at).toBe(
      "2026-10-08T01:00:00.000Z",
    );
    expect(github.rest.repos.createRelease).not.toHaveBeenCalled();
  });

  it("numbers the next release of the month and includes every change since the last", async () => {
    previousRelease();
    commit("feat: later change", "2026-10-07T22:00:00Z");
    vi.setSystemTime(new Date("2026-10-15T09:00:00Z"));
    const plan = await prepareProductionRelease({ github, context, cwd });
    expect(plan.shouldDeploy).toBe(true);
    expect(plan.version).toBe("26.10.02");
    expect(plan.body).toContain("later change");
    expect(plan.body).toContain("/compare/v26.10.01...");
  });

  it("orders double-digit sequence numbers numerically", async () => {
    git("tag", "v26.10.09");
    commit("tenth", "2026-10-04T10:00:00Z");
    previousRelease("v26.10.10", [release("v26.10.09")]);
    commit("eleventh", "2026-10-04T12:00:00Z");
    const plan = await prepareProductionRelease({ github, context, cwd });
    expect(plan.tag).toBe("v26.10.11");
    expect(plan.body).toContain("/compare/v26.10.10...");
    expect(plan.body).not.toContain("tenth");
  });

  it("starts the next month at .01, comparing against the last month's release", async () => {
    previousRelease("v26.10.11");
    commit("november change", "2026-11-02T12:00:00Z");
    vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
    const plan = await prepareProductionRelease({ github, context, cwd });
    expect(plan.tag).toBe("v26.11.01");
    expect(plan.body).toContain("/compare/v26.10.11...");
  });

  it("skips a retry of an already released snapshot", async () => {
    previousRelease("v26.10.03");
    vi.setSystemTime(new Date("2026-10-06T01:00:00Z"));
    const plan = await prepareProductionRelease({ github, context, cwd });
    expect(plan.tag).toBe("v26.10.03");
    expect(plan.shouldDeploy).toBe(false);
    expect(plan.skipReason).toBe("already-released");
    expect(plan).not.toHaveProperty("body");
    expect(plan).not.toHaveProperty("releaseHistory");
    expect(github.rest.repos.createRelease).not.toHaveBeenCalled();
  });

  it("reuses the tag a failed publication left on this snapshot", async () => {
    previousRelease();
    commit("fix: pending deployment", "2026-10-07T22:00:00Z");
    git("tag", "v26.10.02");
    vi.setSystemTime(new Date("2026-10-08T00:17:00Z"));
    const plan = await prepareProductionRelease({ github, context, cwd });
    expect(plan.shouldDeploy).toBe(true);
    await publishProductionRelease({ github, context, ...plan });
    expect(github.rest.repos.createRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        tag_name: "v26.10.02",
        name: "26.10.02",
        target_commitish: context.sha,
      }),
    );
  });

  it("skips numbers taken by unpublished tags on other commits", async () => {
    git("tag", "v26.10.01");
    commit("new change", "2026-10-04T22:00:00Z");
    const plan = await prepareProductionRelease({ github, context, cwd });
    expect(plan.tag).toBe("v26.10.02");
  });

  it("numbers past releases that were not production deployments", async () => {
    github.paginate.mockResolvedValue([
      { ...release("v26.10.01"), body: "manual staging release" },
    ]);
    const plan = await prepareProductionRelease({ github, context, cwd });
    expect(plan.tag).toBe("v26.10.02");
  });

  it("uses today's changes for the first release", async () => {
    commit("yesterday's change", "2026-10-04T22:00:00Z");
    commit("today's change", "2026-10-05T00:01:00Z");
    const plan = await prepareProductionRelease({ github, context, cwd });
    expect(plan.body).toContain("today's change");
    expect(plan.body).not.toContain("yesterday's change");
  });

  it("includes old-authored branch commits merged since the last release and direct main commits", async () => {
    previousRelease();
    git("checkout", "--quiet", "-b", "feature");
    commit("old-authored feature", "2026-09-01T12:00:00Z");
    git("checkout", "--quiet", "main");
    commit("direct main change", "2026-10-04T20:00:00Z");
    execFileSync(
      "git",
      ["merge", "--quiet", "--no-ff", "feature", "-m", "Merge feature (#7)"],
      {
        cwd,
        env: { ...process.env, GIT_COMMITTER_DATE: "2026-10-04T23:00:00Z" },
      },
    );
    context.sha = git("rev-parse", "HEAD");
    const plan = await prepareProductionRelease({ github, context, cwd });
    for (const text of [
      "old-authored feature",
      "direct main change",
      "Merge feature ([#7]",
    ]) {
      expect(plan.body).toContain(text);
    }
    expect(plan.body).toContain(`/compare/v26.10.01...${context.sha}`);
    expect(plan.body).not.toContain("old inherited history");
  });

  it("bootstraps the first production release without recent commits", async () => {
    const plan = await prepareProductionRelease({ github, context, cwd });
    expect(plan.shouldDeploy).toBe(true);
    expect(plan.body).toContain("No new changes merged to main");
  });

  it("deploys new commits even when their trees and rendered changelog are unchanged", async () => {
    previousRelease();
    commit("Merge pull request #7 from feature", "2026-10-04T22:00:00Z");
    expect(git("diff", "v26.10.01", "HEAD")).toBe("");
    const plan = await prepareProductionRelease({ github, context, cwd });
    expect(plan.shouldDeploy).toBe(true);
    expect(plan.body).toContain("No new changes merged to main");
  });

  it("refuses retries that omit already deployed commits", async () => {
    const oldSha = context.sha;
    commit("already deployed change", "2026-10-07T22:00:00Z");
    previousRelease("v26.10.02");
    git("checkout", "--quiet", oldSha);
    context.sha = oldSha;
    vi.setSystemTime(new Date("2026-10-08T00:17:00Z"));
    await expect(
      prepareProductionRelease({ github, context, cwd }),
    ).rejects.toThrow("merge-base --is-ancestor");
  });

  it("bundles the new release's exact notes before GitHub publication", async () => {
    previousRelease();
    commit("fix: repair version history", "2026-10-04T22:00:00Z");
    const plan = await prepareProductionRelease({ github, context, cwd });
    expect(plan.releaseHistory).toEqual([
      {
        tag_name: plan.tag,
        name: plan.version,
        published_at: "2026-10-05T00:02:00.000Z",
        body: plan.body,
      },
      {
        tag_name: "v26.10.01",
        name: "26.10.01",
        published_at: "2026-10-04T00:17:00Z",
        body: marker,
      },
    ]);
    expect(plan.tag).toBe("v26.10.02");
    expect(github.rest.repos.createRelease).not.toHaveBeenCalled();
  });

  it("keeps the new release and only nine older public releases", async () => {
    const older = Array.from({ length: 15 }, (_, i) => ({
      tag_name: `v26.09.${String(i + 1).padStart(2, "0")}`,
      published_at: new Date(Date.UTC(2026, 8, i + 1)).toISOString(),
      body: "Older notes",
      draft: false,
      prerelease: false,
    }));
    github.paginate.mockResolvedValue([
      { ...older[0], tag_name: "draft", draft: true },
      { ...older[0], tag_name: "preview", prerelease: true },
      ...older,
    ]);
    const plan = await prepareProductionRelease({ github, context, cwd });
    expect(plan.releaseHistory.map((release) => release.tag_name)).toEqual([
      plan.tag,
      ...older
        .slice(-9)
        .reverse()
        .map((release) => release.tag_name),
    ]);
  });

  it("refuses a production release from a later month than the execution date", async () => {
    previousRelease("v26.11.01");
    await expect(
      prepareProductionRelease({ github, context, cwd }),
    ).rejects.toThrow("newer production release");
  });

  it("refuses a checkout different from the run's main snapshot", async () => {
    context.sha = "wrong-sha";
    await expect(
      prepareProductionRelease({ github, context, cwd }),
    ).rejects.toThrow("workflow's main commit");
  });

  it("escapes commit subjects so release notes cannot inject Markdown", async () => {
    previousRelease();
    commit(
      "fix [link](https://example.com) <img> `code`",
      "2026-10-04T22:00:00Z",
    );
    const plan = await prepareProductionRelease({ github, context, cwd });
    expect(plan.body).toContain(
      "fix \\[link\\](https://example.com) \\<img\\> \\`code\\`",
    );
  });

  it("publishes the exact deployed SHA with a numbered title and v-prefixed tag", async () => {
    const plan = await prepareProductionRelease({ github, context, cwd });
    await publishProductionRelease({ github, context, ...plan });
    expect(github.rest.repos.createRelease).toHaveBeenCalledWith({
      ...context.repo,
      tag_name: "v26.10.01",
      target_commitish: context.sha,
      name: "26.10.01",
      body: plan.body,
      draft: false,
      prerelease: false,
      make_latest: "true",
    });
  });
});

it("runs backend and release CI when the production workflow changes", () => {
  const path = fileURLToPath(
    new URL("../../../.github/workflows/oxytype-ci.yml", import.meta.url),
  );
  const workflow = parse(readFileSync(path, "utf8"));
  const filter = workflow.jobs["pre-ci"].steps.find(
    (step) => step.id === "filter",
  );
  const paths = parse(filter.with.filters);
  for (const key of ["be-src", "pkg-src"]) {
    expect(paths[key]).toContain(".github/workflows/production-release.yml");
  }
});

it("wires manual-only production deployment before publication and always cleans credentials", () => {
  const path = fileURLToPath(
    new URL(
      "../../../.github/workflows/production-release.yml",
      import.meta.url,
    ),
  );
  const workflow = parse(readFileSync(path, "utf8"));
  expect(workflow.name).toBe("Production release");
  expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
  expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
  const job = workflow.jobs.release;
  expect(job.if).toContain("github.ref == 'refs/heads/main'");
  expect(job.environment.name).toBe("production");
  expect(job.if).toContain("vars.START_PRODUCTION_ENABLED == 'true'");
  expect(
    job.steps.find(
      (step) => step.name === "Retain matched Start release artifact",
    ).with["include-hidden-files"],
  ).toBe(true);
  const steps = job.steps;
  const plan = steps.findIndex((step) => step.id === "plan");
  expect(plan).toBeGreaterThan(0);
  const validation = steps.findIndex((step) => step.id === "validate-ci");
  expect(workflow.permissions.actions).toBe("read");
  expect(validation).toBeGreaterThan(plan);
  expect(steps[validation].env.RELEASE_SHA).toBe(
    "${{ steps.plan.outputs.sha }}",
  );
  expect(steps[validation].with.script).toContain(
    "requireSuccessfulProductionCI({ github, context, sha: process.env.RELEASE_SHA })",
  );
  expect(
    steps.findIndex(
      (step) =>
        step.name === "Prepare production credentials and build settings",
    ),
  ).toBeGreaterThan(validation);
  expect(
    steps.findIndex((step) => step.name === "Apply production D1 migrations"),
  ).toBeGreaterThan(validation);
  for (const step of steps.slice(plan + 1, -1)) {
    expect(step.if, step.name).toBe(
      "steps.plan.outputs.shouldDeploy == 'true'",
    );
  }
  const deploy = steps.findIndex(
    (step) => step.name === "Deploy production with Wrangler",
  );
  const publish = steps.findIndex(
    (step) => step.name === "Publish GitHub release after deployment",
  );
  expect(deploy).toBeGreaterThan(
    steps.findIndex((step) => step.name === "Apply production D1 migrations"),
  );
  expect(publish).toBeGreaterThan(deploy);
  expect(steps[deploy].run).toContain(
    "--filter @oxytype/frontend deploy:production-site",
  );
  expect(steps[publish].if).toBe("steps.plan.outputs.shouldDeploy == 'true'");
  expect(steps.at(-1).if).toBe("always()");
});

it.each(["", "ba_dashboard_workflow_fixture"])(
  "materializes the optional dashboard key only into the private backend file (%s)",
  (apiKey) => {
    const workflow = parse(
      readFileSync(
        fileURLToPath(
          new URL(
            "../../../.github/workflows/production-release.yml",
            import.meta.url,
          ),
        ),
        "utf8",
      ),
    );
    const settings = workflow.jobs.release.steps.find(
      (step) =>
        step.name === "Prepare production credentials and build settings",
    );
    expect(settings.env.BETTER_AUTH_API_KEY).toBe(
      "${{ secrets.BETTER_AUTH_API_KEY }}",
    );
    const script = settings.run.match(/<<'NODE'\n([\s\S]+)\nNODE/)?.[1];
    if (script === undefined) {
      throw new Error("Missing production settings script");
    }
    const directory = mkdtempSync(
      join(tmpdir(), "oxytype-dashboard-settings-"),
    );
    try {
      mkdirSync(join(directory, "backend"));
      mkdirSync(join(directory, "frontend"));
      writeFileSync(
        join(directory, "package.json"),
        JSON.stringify({ version: "old" }),
      );
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
          RELEASE_VERSION: "26.10.04",
        },
      });
      const backendPath = join(directory, "frontend/.dev.vars.production");
      const backend = parseEnv(readFileSync(backendPath, "utf8"));
      expect(backend.BETTER_AUTH_SECRET).toBe("auth-secret-fixture");
      expect(backend.BETTER_AUTH_API_KEY).toBe(
        apiKey || "existing-dashboard-key",
      );
      expect(statSync(backendPath).mode & 0o777).toBe(0o600);
      expect(
        readFileSync(join(directory, "frontend/.env.production.local"), "utf8"),
      ).toBe(frontend);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
