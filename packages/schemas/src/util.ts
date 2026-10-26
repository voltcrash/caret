import { z, ZodString } from "zod";
import "@caret/util/zod-messages";

export const StringNumberSchema = z
  .string()
  .regex(
    /^\d+$/,
    'Needs to be a number or a number represented as a string e.g. "10".',
  )
  .or(z.number().transform(String));
export type StringNumber = z.infer<typeof StringNumberSchema>;
export const token = (): ZodString => z.string().regex(/^[a-zA-Z0-9_]+$/);

export const slug = (): ZodString =>
  z
    .string()
    .regex(
      /^[0-9a-zA-Z_.-]+$/,
      "Only letters, numbers, underscores, dots and hyphens allowed",
    )
    .regex(/^[^.].*$/, "Cannot start with a dot");

export const nameWithSeparators = (): ZodString =>
  z
    .string()
    .regex(
      /^[0-9a-zA-Z_-]+$/,
      "Only letters, numbers, underscores and hyphens allowed",
    )
    .regex(
      /^[a-zA-Z0-9]+(?:[_-][a-zA-Z0-9]+)*$/,
      "Separators cannot be at the start or end, or appear multiple times in a row",
    );

// Authentication IDs include UUIDs and legacy provider IDs.
export const UidSchema = z.string().min(1).max(128);

export const IdSchema = token();
export type Id = z.infer<typeof IdSchema>;

export const TagSchema = token().max(50);
export type Tag = z.infer<typeof TagSchema>;

export const NullableStringSchema = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? undefined);
export type NullableString = z.infer<typeof NullableStringSchema>;

export const PercentageSchema = z.number().nonnegative().max(100);
export type Percentage = z.infer<typeof PercentageSchema>;

export const WpmSchema = z.number().nonnegative().max(420);
export type Wpm = z.infer<typeof WpmSchema>;

export const CustomTextModeSchema = z.enum(["repeat", "random", "shuffle"]);
export type CustomTextMode = z.infer<typeof CustomTextModeSchema>;

export const CustomTextLimitModeSchema = z.enum(["word", "time", "section"]);
export type CustomTextLimitMode = z.infer<typeof CustomTextLimitModeSchema>;

export function customEnumErrorHandler(message: string): z.core.$ZodErrorMap {
  // Zod 3 only used the custom message for strings; other input was a
  // type error, which this handler reported as "Required".
  return (issue) =>
    issue.code === "invalid_value" && typeof issue.input === "string"
      ? `Invalid enum value. ${message}`
      : (issue.message ?? "Required");
}

export const PageNumberSchema = z
  .number()
  .int()
  // zod 3's .safe()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER)
  .nonnegative()
  .default(0);

/**
 * A record keyed by an enum or literals, with Zod 3 semantics: every key is
 * optional and an unknown key fails at its own path, so sanitize drops just
 * that key instead of the whole record.
 */
export function partialRecord<
  K extends z.ZodType<PropertyKey, PropertyKey>,
  V extends z.ZodType,
>(
  key: K,
  value: V,
): z.ZodRecord<z.ZodCustom<z.output<K>, z.output<K>> & z.core.$partial, V> {
  return z.partialRecord(
    z.custom<z.output<K>>((input) => key.safeParse(input).success, {
      error: (issue) => key.safeParse(issue.input).error?.issues[0]?.message,
    }),
    value,
  );
}
