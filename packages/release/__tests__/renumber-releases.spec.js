import { describe, expect, it, vi } from "vite-plus/test";
import { applyRenumber, planRenumber } from "../src/renumber-releases.js";

const marker = "<!-- oxytype-production-release -->";
const release = (id, tag, publishedAt, body = marker) => ({
  id,
  tag_name: tag,
  target_commitish: `sha-${tag}`,
  published_at: publishedAt,
  body,
  draft: false,
  prerelease: false,
});

describe("renumbering date releases", () => {
  const releases = [
    release(
      3,
      "v26.10.07",
      "2026-10-07T06:00:00Z",
      `Compare v26.10.05...abc\n${marker}`,
    ),
    release(1, "v26.10.04", "2026-10-04T12:00:00Z"),
    release(
      2,
      "v26.10.05",
      "2026-10-05T02:00:00Z",
      `Compare v26.10.04...def\n${marker}`,
    ),
    release(
      4,
      "v26.11.03",
      "2026-11-03T09:00:00Z",
      `Compare v26.10.07...ghi\n${marker}`,
    ),
    { ...release(9, "v26.10.20", "2026-10-20T00:00:00Z"), draft: true },
    release(8, "v26.10.21", "2026-10-21T00:00:00Z", "manual notes"),
  ];

  it("numbers each month's production releases in publication order", () => {
    const plan = planRenumber(releases);
    expect(plan.map(({ from, to }) => [from, to])).toEqual([
      ["v26.10.04", "v26.10.01"],
      ["v26.10.05", "v26.10.02"],
      ["v26.10.07", "v26.10.03"],
      ["v26.11.03", "v26.11.01"],
    ]);
  });

  it("rewrites renamed tags in release notes", () => {
    const bodies = Object.fromEntries(
      planRenumber(releases).map((rename) => [rename.to, rename.body]),
    );
    expect(bodies["v26.10.02"]).toContain("Compare v26.10.01...def");
    expect(bodies["v26.10.03"]).toContain("Compare v26.10.02...abc");
    expect(bodies["v26.11.01"]).toContain("Compare v26.10.03...ghi");
  });

  it("is idempotent once releases are renumbered", () => {
    const renamed = planRenumber(releases).map((rename) => ({
      ...release(rename.id, rename.to, ""),
      published_at: releases.find((r) => r.id === rename.id).published_at,
      body: rename.body,
    }));
    expect(planRenumber(renamed)).toEqual([]);
  });
});

describe("applying a renumber plan", () => {
  function fakeGithub(tags) {
    const refs = new Map(Object.entries(tags));
    const calls = [];
    return {
      calls,
      refs,
      paginate: vi.fn(async () =>
        [...refs].map(([tag, sha]) => ({
          ref: `refs/tags/${tag}`,
          object: { sha },
        })),
      ),
      rest: {
        git: {
          listMatchingRefs: vi.fn(),
          createRef: vi.fn(async ({ ref, sha }) => {
            calls.push(["create", ref, sha]);
            refs.set(ref.slice(10), sha);
          }),
          deleteRef: vi.fn(async ({ ref }) => {
            calls.push(["delete", ref]);
            refs.delete(ref.slice(5));
          }),
        },
        repos: {
          updateRelease: vi.fn(async ({ release_id, tag_name, name }) => {
            calls.push(["release", release_id, tag_name, name]);
          }),
        },
      },
    };
  }
  const repo = { owner: "voltcrash", repo: "oxytype" };

  it("frees each old tag before a later release takes its number", async () => {
    const github = fakeGithub({
      "v26.10.04": "a",
      "v26.10.05": "b",
      "v26.10.07": "c",
      "v2026.10.04": "a",
    });
    const plan = [
      { id: 1, sha: "a", from: "v26.10.04", to: "v26.10.01", body: "1" },
      { id: 2, sha: "b", from: "v26.10.05", to: "v26.10.02", body: "2" },
      { id: 3, sha: "c", from: "v26.10.07", to: "v26.10.04", body: "3" },
    ];
    await applyRenumber({ github, repo, plan });
    expect([...github.refs].sort()).toEqual([
      ["v2026.10.04", "a"],
      ["v26.10.01", "a"],
      ["v26.10.02", "b"],
      ["v26.10.04", "c"],
    ]);
    expect(github.calls.filter(([kind]) => kind === "release")).toEqual([
      ["release", 1, "v26.10.01", "26.10.01"],
      ["release", 2, "v26.10.02", "26.10.02"],
      ["release", 3, "v26.10.04", "26.10.04"],
    ]);
  });

  it("stops before overwriting a tag held by another commit", async () => {
    const github = fakeGithub({ "v26.10.04": "a", "v26.10.01": "other" });
    await expect(
      applyRenumber({
        github,
        repo,
        plan: [
          { id: 1, sha: "a", from: "v26.10.04", to: "v26.10.01", body: "" },
        ],
      }),
    ).rejects.toThrow("v26.10.01 already points at other");
    expect(github.rest.repos.updateRelease).not.toHaveBeenCalled();
  });
});
