import { describe, expect, it } from "vite-plus/test";
import { buildReleaseChangelog } from "../src/changelog.js";

const repoUrl = "https://github.com/voltcrash/oxytype";
const hash = (n) => String(n).repeat(40);

describe("buildReleaseChangelog", () => {
  it("groups user facing commits into sections in a fixed order", () => {
    const notes = buildReleaseChangelog(
      [
        { hash: hash(1), subject: "fix(settings): keep footer visible" },
        { hash: hash(2), subject: "feat: add delete on error" },
        { hash: hash(3), subject: "impr(quotes): add quotes" },
      ],
      repoUrl,
    );
    expect(notes).toBe(
      [
        "### Features",
        "",
        `- add delete on error ([2222222](${repoUrl}/commit/${hash(2)}))`,
        "",
        "### Improvements",
        "",
        `- **quotes:** add quotes ([3333333](${repoUrl}/commit/${hash(3)}))`,
        "",
        "### Fixes",
        "",
        `- **settings:** keep footer visible ([1111111](${repoUrl}/commit/${hash(1)}))`,
      ].join("\n"),
    );
  });

  it("lists other commits under nerd stuff with their type", () => {
    const notes = buildReleaseChangelog(
      [
        { hash: hash(1), subject: "refactor(utils): remove helper" },
        { hash: hash(2), subject: "chore: bump deps" },
        { hash: hash(3), subject: "tidy up" },
      ],
      repoUrl,
    );
    expect(notes).toContain("### Nerd stuff\n\n");
    expect(notes).toContain("- **refactor(utils):** remove helper (");
    expect(notes).toContain("- **chore:** bump deps (");
    expect(notes).toContain("- tidy up (");
    expect(notes).not.toContain("### Features");
  });

  it("links squash merged pull requests", () => {
    const notes = buildReleaseChangelog(
      [{ hash: hash(1), subject: "ci(production): add daily releases (#28)" }],
      repoUrl,
    );
    expect(notes).toContain(
      `- **ci(production):** add daily releases ([#28](${repoUrl}/pull/28)) ([1111111](${repoUrl}/commit/${hash(1)}))`,
    );
  });

  it("omits github merge commits", () => {
    const notes = buildReleaseChangelog(
      [
        {
          hash: hash(1),
          subject: "Merge pull request #26 from voltcrash/settings",
        },
        { hash: hash(2), subject: "Merge branch 'main' into settings" },
        { hash: hash(3), subject: "feat(settings): add sidebar" },
      ],
      repoUrl,
    );
    expect(notes).not.toContain("Merge");
    expect(notes).toContain("add sidebar");
  });

  it("returns an empty string without commits", () => {
    expect(buildReleaseChangelog([], repoUrl)).toBe("");
  });

  it("escapes markdown in scopes and messages", () => {
    const notes = buildReleaseChangelog(
      [{ hash: hash(1), subject: "fix(a_b): handle [x](y) <img>" }],
      repoUrl,
    );
    expect(notes).toContain("**a\\_b:** handle \\[x\\](y) \\<img\\>");
  });
});
