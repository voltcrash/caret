import { runtime, type Runtime } from "../runtime/env";
import { PreparedQuery, type QueryValue } from "./query";
import { postgresError } from "./retry";

export const database = (): Runtime["db"] => runtime().db;
export const primaryDatabase = database;

export function statement(query: string, ...values: QueryValue[]): PreparedQuery {
  runtime().metrics.dbStatements++;
  return new PreparedQuery(runtime().sql, query, values);
}
export function isUniqueViolation(error: unknown): boolean { return postgresError(error)?.code === "23505"; }

/** Bound payload size keeps large result histories out of individual rows. */
export function encode(value: unknown): string {
  const data = JSON.stringify(value);
  if (data === undefined || new TextEncoder().encode(data).length > 1_500_000) {
    throw new Error("Database payload must be defined and below 1.5 MB");
  }
  return data;
}
