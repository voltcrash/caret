import { z } from "zod";

type Schema = z.ZodObject<Record<string, z.ZodType>>;

function isText(schema: z.core.$ZodType): boolean {
  return (
    schema instanceof z.ZodString ||
    schema instanceof z.ZodEnum ||
    schema instanceof z.ZodLiteral ||
    (schema instanceof z.ZodUnion &&
      schema.options.every(
        (option) =>
          option instanceof z.ZodLiteral || option instanceof z.ZodEnum,
      ))
  );
}
function decode(value: string): unknown {
  try {
    const padded = value.padEnd(
      value.length + ((4 - (value.length % 4)) % 4),
      "=",
    );
    return JSON.parse(
      decodeURIComponent(
        Array.from(
          atob(padded),
          (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`,
        ).join(""),
      ),
    ) as unknown;
  } catch {
    return undefined;
  }
}
function encode(value: unknown): string {
  return btoa(
    encodeURIComponent(JSON.stringify(value)).replace(
      /%([0-9A-F]{2})/g,
      (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)),
    ),
  ).replace(/=+$/, "");
}
function parseValue(value: string, schema: z.core.$ZodType): unknown {
  if (schema instanceof z.ZodNumber) {
    const number = Number(value);
    return Number.isNaN(number) ? undefined : number;
  }
  if (schema instanceof z.ZodBoolean) return value === "t" || value === "true";
  if (schema instanceof z.ZodDate) return new Date(value);
  if (schema instanceof z.ZodBigInt) return BigInt(value);
  if (schema instanceof z.ZodPipe) {
    return parseValue(
      value,
      schema.in instanceof z.ZodTransform ? schema.out : schema.in,
    );
  }
  if (schema instanceof z.ZodDefault || schema instanceof z.ZodOptional) {
    return parseValue(value, schema.unwrap());
  }
  if (isText(schema)) return value;
  return decode(value);
}
function serializeValue(
  value: unknown,
  schema: z.core.$ZodType | undefined,
): string | undefined {
  if (schema !== undefined && isText(schema)) {
    return value as string | undefined;
  }
  if (schema instanceof z.ZodNumber) return z.number().parse(value).toString();
  if (schema instanceof z.ZodBoolean) {
    return z.boolean().parse(value) ? "t" : "f";
  }
  if (schema instanceof z.ZodDate) return z.date().parse(value).toISOString();
  if (schema instanceof z.ZodBigInt) return z.bigint().parse(value).toString();
  if (schema instanceof z.ZodPipe) {
    return serializeValue(
      value,
      schema.in instanceof z.ZodTransform ? schema.out : schema.in,
    );
  }
  if (schema instanceof z.ZodDefault) {
    const serialized = serializeValue(value, schema.unwrap());
    return serialized ===
      serializeValue(schema._zod.def.defaultValue, schema.unwrap())
      ? undefined
      : serialized;
  }
  if (schema instanceof z.ZodOptional) {
    return serializeValue(value, schema.unwrap());
  }
  return encode(value);
}

/** Preserve flat URLs: repeated arrays, last scalar value and schema defaults. */
export function safeParse<T extends Schema>({
  schema,
  input,
  defaultData,
}: {
  schema: T;
  input: URLSearchParams;
  defaultData?: Partial<z.input<T>>;
}): z.ZodSafeParseResult<z.output<T>> {
  const data: Record<string, unknown> = { ...defaultData };
  for (const [key, field] of Object.entries(schema.shape)) {
    const values = input.getAll(key);
    if (field instanceof z.ZodArray) {
      data[key] = values.map((value) => parseValue(value, field.element));
    } else if (values.length > 0) {
      data[key] = parseValue(values[values.length - 1] as string, field);
    }
  }
  return schema.safeParse(data);
}
function isScalar(value: unknown): boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    value instanceof Date
  );
}
export function serialize<T extends Schema>({
  schema,
  data,
  defaultData,
}: {
  schema: T;
  data: Partial<z.input<T>>;
  defaultData?: Partial<z.input<T>>;
}): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    const defaultValue = defaultData?.[key];
    if (
      defaultData !== undefined &&
      (isScalar(value) && isScalar(defaultValue)
        ? value === defaultValue
        : JSON.stringify(value) === JSON.stringify(defaultValue))
    ) {
      continue;
    }
    const field = schema.shape[key];
    const values = field instanceof z.ZodArray ? (value as unknown[]) : [value];
    for (const item of values) {
      const serialized = serializeValue(
        item,
        field instanceof z.ZodArray ? field.element : field,
      );
      if (serialized !== undefined) params.append(key, serialized);
    }
  }
  return params;
}
