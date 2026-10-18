import { execFileSync } from "node:child_process";
import { buildReleaseChangelog } from "./changelog.js";
import {
  compareReleaseTags,
  getNextReleaseVersion,
  getReleaseMonth,
  releaseTagPattern,
} from "./version.js";
import { buildReleaseHistory } from "./release-history.js";

const productionMarker = "<!-- oxytype-production-release -->";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function tagCommit(cwd, tag) {
  return git(cwd, "rev-parse", `${tag}^{commit}`);
}

export async function prepareProductionRelease({ github, context, cwd }) {
  // Retried runs number the release when planning executes.
  const date = new Date();
  const sha = git(cwd, "rev-parse", "HEAD");
  if (sha !== context.sha) {
    throw new Error("Release checkout must match the workflow's main commit");
  }

  const releases = await github.paginate(github.rest.repos.listReleases, {
    ...context.repo,
    per_page: 100,
  });
  const productionReleases = releases
    .filter(
      (release) =>
        !release.draft &&
        !release.prerelease &&
        releaseTagPattern.test(release.tag_name) &&
        release.body?.includes(productionMarker),
    )
    .sort((a, b) => compareReleaseTags(b.tag_name, a.tag_name));
  const previous = productionReleases[0];
  if (
    previous !== undefined &&
    previous.tag_name.slice(0, 6) > getReleaseMonth(date)
  ) {
    throw new Error(
      "A newer production release exists; dispatch a new run from main",
    );
  }
  if (previous !== undefined && tagCommit(cwd, previous.tag_name) === sha) {
    const tag = previous.tag_name;
    return {
      version: tag.slice(1),
      tag,
      sha,
      shouldDeploy: false,
      skipReason: "already-released",
    };
  }

  // A deployment whose publication failed leaves its tag on this snapshot;
  // reuse that number instead of skipping one.
  const tags = git(cwd, "tag", "--list", `${getReleaseMonth(date)}.*`)
    .split("\n")
    .filter((tag) => releaseTagPattern.test(tag));
  const released = new Set(releases.map((release) => release.tag_name));
  const tag =
    tags.find(
      (candidate) =>
        !released.has(candidate) && tagCommit(cwd, candidate) === sha,
    ) ??
    getNextReleaseVersion(
      [...tags, ...releases.map((release) => release.tag_name)],
      date,
    );
  const version = tag.slice(1);
  const existing = releases.find((release) => release.tag_name === tag);
  if (existing !== undefined) {
    throw new Error(
      `Release ${tag} already exists outside the production deployment`,
    );
  }

  let base;
  if (previous !== undefined) {
    base = previous.tag_name;
    // Fail on rewritten history rather than silently publishing misleading notes.
    git(cwd, "merge-base", "--is-ancestor", base, sha);
  } else {
    // The first release covers the current UTC day, without dumping the
    // fork's entire inherited history.
    const dayStart = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    );
    base = git(
      cwd,
      "rev-list",
      "--first-parent",
      "-1",
      `--before=${new Date(dayStart - 1000).toISOString()}`,
      sha,
    );
  }

  const repoUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}`;
  // Revision ranges include old-authored branch commits merged today. Filtering
  // commit author dates would lose those changes, and rebase/squash merges.
  const commits = git(
    cwd,
    "log",
    "--reverse",
    "--format=%H%x00%s",
    base ? `${base}..${sha}` : sha,
  );
  if (previous !== undefined && commits === "") {
    return {
      version,
      tag,
      sha,
      shouldDeploy: false,
      skipReason: "no-new-commits",
    };
  }
  const changelog = buildReleaseChangelog(
    commits
      ? commits.split("\n").map((line) => {
          const [hash, subject] = line.split("\0");
          return { hash, subject };
        })
      : [],
    repoUrl,
  );
  const changes =
    changelog ||
    "No new changes merged to main since the previous production release.";
  const comparison = base
    ? `\n\n**Full changelog:** [${base}...${sha.slice(0, 7)}](${repoUrl}/compare/${base}...${sha})`
    : "";
  const body = `${changes}${comparison}\n\nDeployed to [production](https://oxytype.voltcrash.com) from [${sha.slice(0, 7)}](${repoUrl}/commit/${sha}).\n\n${productionMarker}\n`;
  // The new GitHub release is published after deployment, so include its
  // planned notes in the assets being deployed instead of lagging a day behind.
  const releaseHistory = buildReleaseHistory([
    {
      tag_name: tag,
      name: version,
      published_at: date.toISOString(),
      body,
      draft: false,
      prerelease: false,
    },
    ...releases,
  ]);
  return { version, tag, sha, body, releaseHistory, shouldDeploy: true };
}

export async function publishProductionRelease({
  github,
  context,
  version,
  tag,
  sha,
  body,
}) {
  return github.rest.repos.createRelease({
    ...context.repo,
    tag_name: tag,
    target_commitish: sha,
    name: version,
    body,
    draft: false,
    prerelease: false,
    make_latest: "true",
  });
}
