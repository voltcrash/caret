import { z } from "zod";
import { LanguageSchema } from "./languages";
import { UserNameWithoutFilterSchema } from "./users";

export const BrowserHandoffSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("quote-submit"), language: LanguageSchema }),
  z.object({
    action: z.literal("quote-report"),
    language: LanguageSchema,
    quoteId: z.coerce.number().int().positive(),
  }),
  z.object({
    action: z.literal("user-report"),
    username: UserNameWithoutFilterSchema,
  }),
]);
export type BrowserHandoff = z.infer<typeof BrowserHandoffSchema>;

export function browserHandoffUrl(
  base: string,
  handoff: BrowserHandoff | "signup",
): string {
  const url = new URL(
    `${base.replace(/\/$/, "")}/${handoff === "signup" ? "login" : ""}`,
  );
  if (handoff !== "signup") {
    const parsed = BrowserHandoffSchema.parse(handoff);
    url.searchParams.set("terminalAction", parsed.action);
    for (const [key, value] of Object.entries(parsed)) {
      if (key !== "action") url.searchParams.set(key, String(value));
    }
  }
  return url.href;
}

export function parseBrowserHandoff(
  search: string,
): BrowserHandoff | undefined {
  const params = new URLSearchParams(search);
  const action = params.get("terminalAction");
  if (action === null) return undefined;
  return BrowserHandoffSchema.parse({ ...Object.fromEntries(params), action });
}
