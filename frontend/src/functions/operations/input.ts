import { z } from "zod";

const InputSchema = z
  .object({
    params: z.record(z.string(), z.unknown()).optional(),
    query: z.record(z.string(), z.unknown()).optional(),
    body: z.unknown().optional(),
  })
  .strict();

/**
 * Transport shape only. Contract validation runs inside the policy runner,
 * after authentication and limits, exactly where the legacy route ran it.
 */
export function operationInput(input: unknown): z.output<typeof InputSchema> {
  return InputSchema.parse(input);
}
