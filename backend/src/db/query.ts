import { types, type Pool, type PoolClient } from "pg";

export const queryTypes = {
  getTypeParser: (
    oid: number,
    format?: "text" | "binary",
  ): ((value: string) => unknown) =>
    oid === 20 || oid === 1700
      ? Number
      : (types.getTypeParser(oid, format) as (value: string) => unknown),
};

export type QueryValue = string | number | boolean | Date | null;
export type QueryResult<T = Record<string, unknown>> = {
  results: T[];
  rowCount: number;
};

/** A deferred PostgreSQL query, also usable in one PostgreSQL transaction. */
export class PreparedQuery {
  readonly sql: string;
  readonly client: Pool | PoolClient;
  readonly values: QueryValue[];
  readonly parsers: typeof queryTypes;
  constructor(
    client: Pool | PoolClient,
    query: string,
    values: QueryValue[] = [],
    parsers = queryTypes,
  ) {
    this.parsers = parsers;
    this.client = client;
    this.values = values;
    let index = 0;
    this.sql = query.replace(/\?/g, () => `$${++index}`);
  }
  async all<T = Record<string, unknown>>(): Promise<QueryResult<T>> {
    const result = await this.client.query({
      text: this.sql,
      values: this.values,
      types: this.parsers,
    });
    return { results: result.rows as T[], rowCount: result.rowCount ?? 0 };
  }
  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const { results } = await this.all();
    const row = results[0];
    return (
      row === undefined ? null : column === undefined ? row : row[column]
    ) as T | null;
  }
  async run(): Promise<QueryResult> {
    return await this.all();
  }
}
