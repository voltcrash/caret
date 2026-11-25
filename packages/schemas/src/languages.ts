import { z } from "zod";
import { KnownFontNameSchema } from "./fonts";
import { customEnumErrorHandler } from "./util";
import { LANGUAGE_NAMES } from "./language-names";

export const LanguageSchema = z.enum(LANGUAGE_NAMES, {
  error: customEnumErrorHandler("Must be a supported language"),
});

export type Language = z.infer<typeof LanguageSchema>;

export const LanguageObjectSchema = z
  .object({
    name: LanguageSchema,
    rightToLeft: z.boolean().optional(),
    noLazyMode: z.boolean().optional(),
    joiningScript: z.boolean().optional(),
    orderedByFrequency: z.boolean().optional(),
    words: z.array(z.string()).min(1),
    additionalAccents: z
      .array(z.tuple([z.string().min(1), z.string().min(1)]))
      .optional(),
    bcp47: z.string().optional(),
    preferredFont: KnownFontNameSchema.optional(),
    originalPunctuation: z.boolean().optional(),
  })
  .strict();
export type LanguageObject = z.infer<typeof LanguageObjectSchema>;
