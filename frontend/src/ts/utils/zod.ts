import {
  ZodBranded,
  ZodDefault,
  ZodEffects,
  ZodFirstPartyTypeKind,
  ZodNullable,
  ZodOptional,
  ZodTypeAny,
} from "zod/v3";

export function getZodType(schema: ZodTypeAny): ZodFirstPartyTypeKind {
  const definition = schema._def as { typeName: ZodFirstPartyTypeKind };
  return definition.typeName;
}

/**
 * Unwraps a Zod schema by removing wrappers like optional, default, nullable,
 * returning the underlying inner schema.
 **/
export function unwrapSchema(schema: ZodTypeAny): ZodTypeAny {
  let current = schema;

  while (true) {
    if (current instanceof ZodOptional) {
      current = current.unwrap() as ZodTypeAny;
      continue;
    }
    if (current instanceof ZodDefault) {
      current = current.removeDefault() as ZodTypeAny;
      continue;
    }
    if (current instanceof ZodNullable) {
      current = current.unwrap() as ZodTypeAny;
      continue;
    }
    if (current instanceof ZodEffects) {
      current = current.innerType() as ZodTypeAny;
      continue;
    }
    if (current instanceof ZodBranded) {
      current = current.unwrap() as ZodTypeAny;
      continue;
    }

    break;
  }

  return current;
}

export { getOptions } from "@oxytype/util/zod";
