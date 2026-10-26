import { z } from "zod";

export type ZodTypeName = z.ZodType["def"]["type"];

export function getZodType(schema: z.ZodType): ZodTypeName {
  return schema.def.type;
}

/**
 * Unwraps a Zod schema by removing wrappers like optional, default, nullable,
 * returning the underlying inner schema.
 **/
export function unwrapSchema(schema: z.ZodType): z.ZodType {
  let current = schema;

  while (true) {
    if (
      current instanceof z.ZodOptional ||
      current instanceof z.ZodDefault ||
      current instanceof z.ZodNullable
    ) {
      current = current.unwrap() as z.ZodType;
      continue;
    }
    // `.transform()` pipes the input schema into a transform
    if (current instanceof z.ZodPipe && current.out instanceof z.ZodTransform) {
      current = current.in as z.ZodType;
      continue;
    }

    break;
  }

  return current;
}

export { getOptions } from "@caret/util/zod";
