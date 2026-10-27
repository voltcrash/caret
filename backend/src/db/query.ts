import { types, type NeonQueryFunction } from "@neondatabase/serverless";

export const queryTypes = { getTypeParser: (oid: number, format?: "text" | "binary") => oid === 20 || oid === 1700 ? Number : types.getTypeParser(oid, format) };

export type QueryValue = string | number | boolean | Date | null;
export type QueryResult<T = Record<string, unknown>> = { results: T[]; rowCount: number };

/** A deferred PostgreSQL query, also usable in one Neon HTTP transaction. */
export class PreparedQuery {
  readonly sql: string;
  constructor(readonly client: NeonQueryFunction<false, true>, query: string, readonly values: QueryValue[] = []) {
    let index = 0;
    this.sql = query.replace(/\?/g, () => `$${++index}`);
  }
  async all<T = Record<string, unknown>>(): Promise<QueryResult<T>> {
    const result = await this.client.query(this.sql, this.values, { types: queryTypes });
    return { results: result.rows as T[], rowCount: result.rowCount ?? 0 };
  }
  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const { results } = await this.all<Record<string, unknown>>();
    const row = results[0];
    return (row === undefined ? null : column === undefined ? row : row[column]) as T | null;
  }
  async run(): Promise<QueryResult> { return await this.all(); }
}
