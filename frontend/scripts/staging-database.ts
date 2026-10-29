import { z } from "zod";

const bindings = z.object({
  hyperdrive: z
    .array(
      z.object({
        binding: z.literal("HYPERDRIVE"),
        id: z.string().regex(/^[a-f0-9]{32}$/),
      }),
    )
    .length(1),
});

/** Builds may use fixtures; hosted staging must have its own database resource. */
export function requireStagingDatabase(
  staging: unknown,
  production: unknown,
): void {
  const parsed = bindings.safeParse(staging);
  const productionConfig = bindings.parse(production);
  const id = parsed.success ? parsed.data.hyperdrive[0]?.id : undefined;
  if (
    id === undefined ||
    /^0+$/.test(id) ||
    id === productionConfig.hyperdrive[0]?.id
  ) {
    throw new Error(
      "Staging deployment blocked: provision an isolated staging database and set its own HYPERDRIVE ID in wrangler.staging.json",
    );
  }
}
