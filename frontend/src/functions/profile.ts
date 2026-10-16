import { ClientSchema } from "@oxytype/schemas/shared";
import { createServerFn } from "@tanstack/solid-start";
import { z } from "zod";
import { readProfile } from "../server/profile.server";

const ProfileInputSchema = z.object({
  uidOrName: z.string().min(1).max(100),
  client: ClientSchema,
});

export const getProfile = createServerFn({ method: "GET" })
  .validator((input: unknown) => ProfileInputSchema.parse(input))
  .handler(
    async ({ context, data }) => await readProfile(context.services, data),
  );
