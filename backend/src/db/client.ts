import { runtime, type Runtime } from "../runtime/env";
import type {
  D1PreparedStatement,
  D1DatabaseSession,
} from "@cloudflare/workers-types";

export const database = (): Runtime["db"] => runtime().db;
export const primaryDatabase = (): Runtime["primaryDb"] => runtime().primaryDb;
export const binding = (): D1DatabaseSession => runtime().session;

export function statement(
  query: string,
  ...values: (string | number | null)[]
): D1PreparedStatement {
  return binding()
    .prepare(query)
    .bind(...values);
}

export function isUniqueViolation(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.message} ${String(error.cause)}`
      : String(error);
  return message.includes("UNIQUE constraint failed");
}

/** Keep the compatibility payload bounded below D1's 2 MB row limit. */
export function encode(value: unknown): string {
  const data = JSON.stringify(value);
  if (data === undefined || new TextEncoder().encode(data).length > 1_500_000) {
    throw new Error("Database payload must be defined and below 1.5 MB");
  }
  return data;
}
