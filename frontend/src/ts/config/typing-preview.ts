import { z } from "zod";
import { ConfigSchema } from "@caret/schemas/configs";
import { getDefaultConfig } from "@caret/web-shared/config/default-config";
import {
  initialTypingCookie,
  previewKeys,
  previewSettings,
  type InitialTypingSnapshot,
} from "./typing-preview-settings";

export { initialTypingCookie, previewSettings, type InitialTypingSnapshot };

const settingsSchema = ConfigSchema.pick(
  Object.fromEntries(previewKeys.map((key) => [key, true])) as {
    [K in (typeof previewKeys)[number]]: true;
  },
);
const snapshotSchema = z.object({
  // v1 cached the test just played; v2 prepares an unplayed next paragraph.
  version: z.union([z.literal(1), z.literal(2)]),
  seed: z.number().int().min(0).max(0xffffffff),
  key: z.string().regex(/^[a-f0-9]{64}$/),
  engineHash: z.string().regex(/^[a-f0-9]{64}$/),
  words: z.array(z.string().max(256)).min(1).max(60),
  // Older previews predate keyboard preferences; keep their wordset usable.
  settings: settingsSchema.extend({
    keymapMode: ConfigSchema.shape.keymapMode.default("off"),
    keymapLayout: ConfigSchema.shape.keymapLayout.default(
      getDefaultConfig().keymapLayout,
    ),
    keymapStyle: ConfigSchema.shape.keymapStyle.default(
      getDefaultConfig().keymapStyle,
    ),
    keymapLegendStyle: ConfigSchema.shape.keymapLegendStyle.default(
      getDefaultConfig().keymapLegendStyle,
    ),
    keymapKeys: ConfigSchema.shape.keymapKeys.default(
      getDefaultConfig().keymapKeys,
    ),
    keymapSize: ConfigSchema.shape.keymapSize.default(
      getDefaultConfig().keymapSize,
    ),
    layout: ConfigSchema.shape.layout.default("default"),
  }),
});

/** Keep preferences on engine upgrades without painting incompatible words. */
export function selectTypingPreview(
  fallback: InitialTypingSnapshot,
  cached: InitialTypingSnapshot | undefined,
): InitialTypingSnapshot {
  if (cached === undefined) return fallback;
  if (cached.engineHash === fallback.engineHash) return cached;
  return { ...fallback, version: 1, settings: cached.settings };
}

/** Untrusted display data. Only a matching v2 seed may regenerate engine words. */
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
