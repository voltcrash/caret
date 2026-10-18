import { releaseTagPattern } from "./version.js";

const productionMarker = "<!-- oxytype-production-release -->";

/**
 * Maps date-named production releases (vYY.MM.DD) to month sequence numbers
 * (vYY.MM.NN) in publication order. Each release also gets its notes with
 * every renamed tag rewritten, so compare links keep resolving.
 */
export function planRenumber(releases) {
  const production = releases
    .filter(
      (release) =>
        !release.draft &&
        !release.prerelease &&
        releaseTagPattern.test(release.tag_name) &&
        release.body?.includes(productionMarker),
    )
    .sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at));
  const counts = new Map();
  const renames = production.map((release) => {
    const month = `v${release.published_at.slice(2, 7).replace("-", ".")}`;
    const number = (counts.get(month) ?? 0) + 1;
    counts.set(month, number);
    return {
      id: release.id,
      sha: release.target_commitish,
      from: release.tag_name,
      to: `${month}.${String(number).padStart(2, "0")}`,
      body: release.body,
    };
  });
  const map = new Map(renames.map((rename) => [rename.from, rename.to]));
  const rewrite = (text) =>
    text.replace(/\bv\d{2}\.\d{2}\.\d{2,}\b/g, (tag) => map.get(tag) ?? tag);
  return renames
    .map((rename) => ({ ...rename, body: rewrite(rename.body) }))
    .filter(
      (rename) =>
        rename.from !== rename.to ||
        rename.body !==
          production.find((release) => release.id === rename.id)?.body,
    );
}

/**
 * Applies a plan in publication order. Every new number is at most the old
 * day of the month, so a target tag is either unused or was freed by an
 * earlier rename; anything else stops before touching that release.
 */
export async function applyRenumber({ github, repo, plan, log }) {
  const refs = await github.paginate(github.rest.git.listMatchingRefs, {
    ...repo,
    ref: "tags/v",
  });
  const tags = new Map(refs.map((ref) => [ref.ref.slice(10), ref.object.sha]));
  for (const rename of plan) {
    if (rename.from !== rename.to) {
      const existing = tags.get(rename.to);
      if (existing !== undefined && existing !== rename.sha) {
        throw new Error(`${rename.to} already points at ${existing}`);
      }
      if (existing === undefined) {
        await github.rest.git.createRef({
          ...repo,
          ref: `refs/tags/${rename.to}`,
          sha: rename.sha,
        });
        tags.set(rename.to, rename.sha);
      }
    }
    await github.rest.repos.updateRelease({
      ...repo,
      release_id: rename.id,
      tag_name: rename.to,
      name: rename.to.slice(1),
      body: rename.body,
    });
    if (rename.from !== rename.to && tags.get(rename.from) === rename.sha) {
      await github.rest.git.deleteRef({ ...repo, ref: `tags/${rename.from}` });
      tags.delete(rename.from);
    }
    log?.(`${rename.from} -> ${rename.to}`);
  }
}
