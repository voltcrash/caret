import { z } from "zod";
import { ConfigSchema, type Config } from "@caret/schemas/configs";

export const initialTypingCookie = "caret_typing_preview";
const previewKeys = [
  "mode",
  "time",
  "words",
  "quoteLength",
  "punctuation",
  "numbers",
  "language",
  "fontSize",
  "fontFamily",
  "quickRestart",
  "showTestModesNotice",
  "tapeMode",
  "maxLineWidth",
  "timerStyle",
  "timerOpacity",
  "timerColor",
  "highlightMode",
  "flipTestColors",
  "colorfulMode",
  "showAllLines",
] as const;
const settingsSchema = ConfigSchema.pick(
  Object.fromEntries(previewKeys.map((key) => [key, true])) as {
    [K in (typeof previewKeys)[number]]: true;
  },
);
export type PreviewSettings = Pick<Config, (typeof previewKeys)[number]>;
const snapshotSchema = z.object({
  version: z.literal(1),
  seed: z.number().int().min(0).max(0xffffffff),
  key: z.string().regex(/^[a-f0-9]{64}$/),
  engineHash: z.string().regex(/^[a-f0-9]{64}$/),
  words: z.array(z.string().max(256)).min(1).max(60),
  settings: settingsSchema,
});
export type InitialTypingSnapshot = z.infer<typeof snapshotSchema>;

export function previewSettings(config: Config): PreviewSettings {
  return Object.fromEntries(
    previewKeys.map((key) => [key, config[key]]),
  ) as PreviewSettings;
}

/** The preview is untrusted presentation data, never an engine/session input. */
export function readTypingPreview(
  cookie: string,
): InitialTypingSnapshot | undefined {
  const raw = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${initialTypingCookie}=`))
    ?.slice(initialTypingCookie.length + 1);
  if (raw === undefined || raw.length > 3800) return undefined;
  try {
    const parsed = snapshotSchema.safeParse(
      JSON.parse(decodeURIComponent(raw)),
    );
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
