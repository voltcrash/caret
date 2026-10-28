import type { QueryResult as PgQueryResult } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFile, readdir } from "node:fs/promises";
import { PreparedQuery, type QueryValue, queryTypes } from "../../src/db/query";
import { DatabaseClient } from "../../src/db/connection";

export class TestQuery extends PreparedQuery {
  bind(...values: QueryValue[]): TestQuery {
    return new TestQuery(this.client, this.sql, values, this.parsers);
  }
}

/** Real PostgreSQL wire protocol, shared by Node and built Worker fixtures. */
export class TestDatabase {
  readonly pg = new PGlite();
  readonly server = new PGLiteSocketServer({
    db: this.pg,
    host: "127.0.0.1",
    port: 0,
    maxConnections: 20,
  });
  readonly ready = this.server.start();
  get url(): string {
    return `postgresql://postgres:postgres@${this.server.getServerConn()}/postgres`;
  }
  private pool: DatabaseClient | undefined;
  get client(): DatabaseClient {
    return (this.pool ??= new DatabaseClient(this.url));
  }
  prepare(query: string): TestQuery {
    // Fixture callers inspect JSON text; application Drizzle reads native JSONB.
    return new TestQuery(this.client, query, [], {
      getTypeParser: (oid: number) =>
        oid === 114 || oid === 3802 ? String : queryTypes.getTypeParser(oid),
    });
  }
  async batch(queries: PreparedQuery[]): Promise<unknown[]> {
    return await this.client.transaction(async (client) => {
      const results: PgQueryResult[] = [];
      for (const query of queries) {
        results.push(
          await client.query({
            text: query.sql,
            values: query.values,
            types: queryTypes,
          }),
        );
      }
      return results;
    });
  }
  async migrate(): Promise<void> {
    await this.ready;
    const root = new URL("../../migrations/", import.meta.url);
    for (const file of (await readdir(root))
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      await this.pg.exec(await readFile(new URL(file, root), "utf8"));
    }
  }
  async exec(sql: string): Promise<void> {
    await this.pg.exec(sql);
  }
  async close(): Promise<void> {
    await this.pool?.end();
    await this.server.stop();
    await this.pg.close();
  }
}
