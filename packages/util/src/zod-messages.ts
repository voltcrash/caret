import { z } from "zod";

// Zod 4 reworded its default messages. API responses, stored validation
// errors and UI copy all use the Zod 3 wording, so keep it.

function parsedType(data: unknown): string {
  switch (typeof data) {
    case "number":
      return Number.isNaN(data) ? "nan" : "number";
    case "object":
      if (data === null) return "null";
      if (Array.isArray(data)) return "array";
      if (data instanceof Map) return "map";
      if (data instanceof Set) return "set";
      if (data instanceof Date) return "date";
      if (
        typeof (data as { then?: unknown }).then === "function" &&
        typeof (data as { catch?: unknown }).catch === "function"
      ) {
        return "promise";
      }
      return "object";
    default:
      return typeof data;
  }
}

function joinValues(values: readonly unknown[], separator = " | "): string {
  return values
    .map((value) => (typeof value === "string" ? `'${value}'` : String(value)))
    .join(separator);
}

function stringify(value: unknown): string {
  return JSON.stringify(value, (_, v: unknown) =>
    typeof v === "bigint" ? v.toString() : v,
  );
}

function sizeMessage(
  issue: { origin: string; inclusive?: boolean; exact?: boolean },
  bound: number | bigint,
  direction: "min" | "max",
): string {
  const min = direction === "min";
  const relation = issue.exact
    ? "exactly"
    : issue.inclusive === true
      ? min
        ? "at least"
        : "at most"
      : undefined;
  switch (issue.origin) {
    case "array":
    case "set":
      return `Array must contain ${relation ?? (min ? "more than" : "less than")} ${bound} element(s)`;
    case "string":
      return `String must contain ${relation ?? (min ? "over" : "under")} ${bound} character(s)`;
    case "number":
    case "int":
    case "bigint":
      return `Number must be ${
        issue.exact
          ? min
            ? "exactly equal to "
            : "exactly "
          : issue.inclusive === true
            ? min
              ? "greater than or equal to "
              : "less than or equal to "
            : min
              ? "greater than "
              : "less than "
      }${bound}`;
    case "date":
      return `Date must be ${
        issue.exact
          ? "exactly equal to "
          : issue.inclusive === true
            ? min
              ? "greater than or equal to "
              : "smaller than or equal to "
            : min
              ? "greater than "
              : "smaller than "
      }${new Date(Number(bound))}`;
    default:
      return "Invalid input";
  }
}

const formatNames: Record<string, string> = {
  guid: "uuid",
  ipv4: "ip",
  ipv6: "ip",
  cidrv4: "cidr",
  cidrv6: "cidr",
};

export const zod3Messages: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case "invalid_type": {
      if (issue.input === undefined) return "Required";
      if (issue.input instanceof Date && issue.expected === "date") {
        return "Invalid date";
      }
      if (issue.expected === "int") {
        return `Expected integer, received ${
          typeof issue.input === "number" ? "float" : parsedType(issue.input)
        }`;
      }
      return `Expected ${issue.expected}, received ${parsedType(issue.input)}`;
    }
    case "invalid_value": {
      const def = issue.inst?._zod.def as { type?: string } | undefined;
      const kind = def?.type;
      if (kind === "literal" && issue.values.length === 1) {
        return `Invalid literal value, expected ${stringify(issue.values[0])}`;
      }
      // Zod 3 enums type-checked first: non-strings were invalid_type issues.
      if (typeof issue.input !== "string") {
        if (issue.input === undefined) return "Required";
        return `Expected ${joinValues(issue.values)}, received ${parsedType(issue.input)}`;
      }
      return `Invalid enum value. Expected ${joinValues(issue.values)}, received '${issue.input}'`;
    }
    case "unrecognized_keys":
      return `Unrecognized key(s) in object: ${joinValues(issue.keys, ", ")}`;
    case "invalid_union":
      if (issue.discriminator !== undefined && Array.isArray(issue.options)) {
        return `Invalid discriminator value. Expected ${joinValues(issue.options)}`;
      }
      return "Invalid input";
    case "invalid_key":
    case "invalid_element":
      return issue.issues[0]?.message ?? "Invalid input";
    case "invalid_format":
      switch (issue.format) {
        case "regex":
          return "Invalid";
        case "starts_with":
          return `Invalid input: must start with "${String(issue["prefix"])}"`;
        case "ends_with":
          return `Invalid input: must end with "${String(issue["suffix"])}"`;
        case "includes":
          return `Invalid input: must include "${String(issue["includes"])}"`;
        default:
          return `Invalid ${formatNames[issue.format] ?? issue.format}`;
      }
    case "too_small":
      return sizeMessage(issue, issue.minimum, "min");
    case "too_big":
      return sizeMessage(issue, issue.maximum, "max");
    case "not_multiple_of":
      return `Number must be a multiple of ${issue.divisor}`;
    default:
      return "Invalid input";
  }
};

z.config({ customError: zod3Messages });
