import { z } from "zod";

export const UiSessionSchema = z.object({
  uid: z.string(),
  email: z.string(),
  displayName: z.string(),
  providerData: z.array(
    z.object({
      providerId: z.enum(["google", "github"]),
      email: z.string().nullable(),
    }),
  ),
  registered: z.boolean(),
});
export type UiSession = z.infer<typeof UiSessionSchema>;
export const SessionStateSchema = z.object({
  user: UiSessionSchema.nullable(),
  signUpEnabled: z.boolean(),
});
export type SessionState = z.infer<typeof SessionStateSchema>;
