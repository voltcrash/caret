import { PGlite, type PGliteInterface, type Transaction } from "@electric-sql/pglite";
import { neon, neonConfig } from "@neondatabase/serverless";
import { readFile, readdir } from "node:fs/promises";
import { PreparedQuery, type QueryValue, queryTypes } from "../../src/db/query";

// Test-only transport: the real Neon driver speaks its HTTP protocol to real
// PostgreSQL (PGlite). Built Workers use the same handler via outboundService.
const databases = new Map<string, TestDatabase>();
const originalFetch = globalThis.fetch;
neonConfig.fetchFunction = async (url: string, init: RequestInit): Promise<Response> => {
  const response = await postgresFetch(new Request(url, init));
  return response ?? await originalFetch(url, init);
};

export async function postgresFetch(request: Request): Promise<Response | undefined> {
  const connection = request.headers.get("Neon-Connection-String");
  if (connection === null) return undefined;
  const db = databases.get(new URL(connection).hostname);
  if (!db) throw new Error("Unknown test PostgreSQL database");
  return await db.fetch(request);
}

export class TestQuery extends PreparedQuery {
  bind(...values: QueryValue[]): TestQuery { return new TestQuery(this.client, this.sql, values); }
}

export class TestDatabase {
  readonly url = `postgresql://test:test@ep-${crypto.randomUUID()}.neon.tech/test`;
  readonly pg = new PGlite();
  readonly client = neon(this.url, { fullResults: true });
  constructor() { databases.set(new URL(this.url).hostname, this); }
  prepare(query: string): TestQuery {
    // Fixture callers inspect JSON text; application Drizzle reads native JSONB.
    const client = neon(this.url, { fullResults: true });
    const queryClient = Object.assign(client, { query: async (sql: string, values?: QueryValue[]) => await this.client.query(sql, values, { types: { getTypeParser: (oid: number) => oid === 114 || oid === 3802 ? String : queryTypes.getTypeParser(oid) } }) });
    return new TestQuery(queryClient, query);
  }
  async batch(queries: PreparedQuery[]): Promise<unknown[]> {
    return await this.client.transaction(queries.map(
      // oxlint-disable-next-line typescript/promise-function-async -- Neon transactions require deferred query promises, not async wrappers.
      (query) => this.client.query(query.sql, query.values, { types: queryTypes })));
  }
  async migrate(): Promise<void> {
    const root = new URL("../../migrations/", import.meta.url);
    for (const file of (await readdir(root)).filter((name) => name.endsWith(".sql")).sort()) {
      await this.pg.exec(await readFile(new URL(file, root), "utf8"));
    }
  }
  async exec(sql: string): Promise<void> { await this.pg.exec(sql); }
  async close(): Promise<void> { databases.delete(new URL(this.url).hostname); await this.pg.close(); }
  async fetch(request: Request): Promise<Response> {
    const body = await request.json() as { query?: string; params?: string[]; queries?: { query: string; params: string[] }[] };
    const query = async (pg: PGliteInterface | Transaction, item: { query: string; params?: string[] }): Promise<unknown> => {
      const result = await pg.query<unknown[]>(item.query, item.params, { rowMode: "array", parsers: Object.fromEntries([16,20,21,23,25,26,700,701,1043,1082,1114,1184,114,3802,1700].map((oid) => [oid, (value: string) => value])) });
      return { ...result, rowCount: result.rowCount ?? result.affectedRows ?? result.rows.length };
    };
    try {
      const result = body.queries
        ? { results: await this.pg.transaction(async (tx) => { const results: unknown[] = []; for (const item of body.queries ?? []) results.push(await query(tx, item)); return results; }) }
        : await query(this.pg, { query: body.query ?? "", params: body.params });
      return Response.json(result);
    } catch (error) {
      const pg = error as Error & { code?: string; constraint?: string; detail?: string };
      return Response.json({ message: pg.message, code: pg.code, constraint: pg.constraint, detail: pg.detail }, { status: 400 });
    }
  }
}
