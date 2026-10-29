import { expect, it } from "vite-plus/test";
import { requireStagingDatabase } from "../../scripts/staging-database";

const config = (
  id: string,
): { hyperdrive: { binding: string; id: string }[] } => ({
  hyperdrive: [{ binding: "HYPERDRIVE", id }],
});
const production = config("a".repeat(32));
it.each([
  {},
  config("replace-with-staging-hyperdrive-id"),
  config("0".repeat(32)),
  production,
])(
  "blocks staging until an isolated resource is provisioned: %j",
  (staging) => {
    expect(() => requireStagingDatabase(staging, production)).toThrow(
      "Staging deployment blocked",
    );
  },
);
it("allows staging with its own provisioned resource", () => {
  expect(() =>
    requireStagingDatabase(config("b".repeat(32)), production),
  ).not.toThrow();
});
