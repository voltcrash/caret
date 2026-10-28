import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { unstable_readConfig } from "wrangler";
import { bindingName, requiredTiers } from "@caret/backend/rate-counter";
import { LEADERBOARD_CRON, MAINTENANCE_CRON } from "@caret/backend/jobs";

const files = [
  "wrangler.jsonc",
  "wrangler.staging.json",
  "wrangler.production.json",
];
type Deployment = {
  hyperdrive: { binding: string; id: string }[];
  secrets?: { required: string[] };
  ratelimits: {
    name: string;
    namespace_id: string;
    simple: { limit: number; period: number };
  }[];
  triggers: { crons: string[] };
};
const configs = files.map((file) => ({
  file,
  config: unstable_readConfig({
    config: resolve(__dirname, "../..", file),
  }) as unknown as Deployment,
}));

describe.each(configs)("$file", ({ config }) => {
  it("routes database queries through Hyperdrive instead of a URL secret", () => {
    expect(config.hyperdrive).toHaveLength(1);
    expect(config.hyperdrive[0]?.binding).toBe("HYPERDRIVE");
    expect(config.secrets?.required ?? []).not.toContain("DATABASE_URL");
  });
  it("declares every Workers rate limiting budget", () => {
    const declared = new Map(
      config.ratelimits.map((binding) => [binding.name, binding.simple]),
    );
    for (const tier of requiredTiers()) {
      expect(declared.get(bindingName(tier))).toEqual(tier);
    }
    expect(declared.size).toBe(requiredTiers().length);
  });
  it("runs each scheduled job on its own trigger", () => {
    expect(config.triggers.crons).toEqual([LEADERBOARD_CRON, MAINTENANCE_CRON]);
  });
});

it("never shares rate limiting namespaces between deployments", () => {
  const ids = configs.flatMap(({ config }) =>
    config.ratelimits.map((binding) => binding.namespace_id),
  );
  expect(new Set(ids).size).toBe(ids.length);
});
