import { z, ZodError } from "zod";

//from https://github.com/colinhacks/zod/pull/3819
export function isZodError(error: unknown): error is ZodError {
  if (!(error instanceof Error)) return false;

  if (error instanceof ZodError) return true;
  if (error.constructor.name === "ZodError") return true;
  if ("issues" in error && Array.isArray(error.issues)) return true;

  return false;
}

/** Every value a literal, enum, boolean or union of them accepts. */
export function getOptions<T extends z.ZodType>(
  schema: T,
): undefined | z.infer<T>[] {
  if (schema instanceof z.ZodLiteral) {
    return [schema.value] as z.infer<T>[];
  } else if (schema instanceof z.ZodEnum) {
    return schema.options as z.infer<T>[];
  } else if (schema instanceof z.ZodBoolean) {
    return [false, true] as z.infer<T>[];
  } else if (schema instanceof z.ZodUnion) {
    return (schema.options as z.ZodType[])
      .flatMap(getOptions)
      .filter((it) => it !== undefined) as z.infer<T>[];
  }
  return undefined;
}
