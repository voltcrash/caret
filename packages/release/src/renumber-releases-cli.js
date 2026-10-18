// Renumbers existing production releases to vYY.MM.NN.
// Dry run: GH_TOKEN=$(gh auth token) node src/renumber-releases-cli.js
// Apply:   GH_TOKEN=$(gh auth token) node src/renumber-releases-cli.js --apply
import { applyRenumber, planRenumber } from "./renumber-releases.js";

const repo = { owner: "voltcrash", repo: "oxytype" };
const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
if (!token) throw new Error("Set GH_TOKEN (for example `gh auth token`)");

async function request(method, path, body) {
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
  };
  const response = await fetch(
    `https://api.github.com${path}`,
    body === undefined
      ? { method, headers }
      : { method, headers, body: JSON.stringify(body) },
  );
  if (!response.ok) {
    throw new Error(
      `${method} ${path}: ${response.status} ${await response.text()}`,
    );
  }
  return response.status === 204 ? null : await response.json();
}

/** The subset of actions/github-script's client the renumber helpers use. */
const github = {
  async paginate(endpoint, parameters) {
    const results = [];
    for (let page = 1; ; page++) {
      const items = await endpoint({ ...parameters, per_page: 100, page });
      results.push(...items);
      if (items.length < 100) return results;
    }
  },
  rest: {
    repos: {
      listReleases: async ({ owner, repo: name, per_page, page }) =>
        await request(
          "GET",
          `/repos/${owner}/${name}/releases?per_page=${per_page}&page=${page}`,
        ),
      updateRelease: async ({ owner, repo: name, release_id, ...body }) =>
        await request(
          "PATCH",
          `/repos/${owner}/${name}/releases/${release_id}`,
          body,
        ),
    },
    git: {
      listMatchingRefs: async ({ owner, repo: name, ref, per_page, page }) =>
        await request(
          "GET",
          `/repos/${owner}/${name}/git/matching-refs/${ref}?per_page=${per_page}&page=${page}`,
        ),
      createRef: async ({ owner, repo: name, ...body }) =>
        await request("POST", `/repos/${owner}/${name}/git/refs`, body),
      deleteRef: async ({ owner, repo: name, ref }) =>
        await request("DELETE", `/repos/${owner}/${name}/git/refs/${ref}`),
    },
  },
};

const plan = planRenumber(
  await github.paginate(github.rest.repos.listReleases, repo),
);
for (const rename of plan) console.log(`${rename.from} -> ${rename.to}`);
if (process.argv.includes("--apply")) {
  await applyRenumber({ github, repo, plan, log: console.log });
  console.log(
    "Renumbered; other clones: `git fetch --prune --prune-tags --force`.",
  );
} else {
  console.log("Dry run; pass --apply to rename releases and tags.");
}
