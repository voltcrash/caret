import { Pool, type PoolClient } from "pg";

/** Invocation-owned sockets; Hyperdrive owns the database connection pool. */
export class DatabaseClient extends Pool {
  constructor(connectionString: string) {
    super({ connectionString, max: 5, connectionTimeoutMillis: 10_000 });
    // A failed idle socket is discarded by pg; the next query opens a new one.
    this.on("error", () => {
      /* pg removes failed idle clients from this pool. */
    });
  }

  async transaction<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.connect();
    let failed = false;
    try {
      await client.query("BEGIN");
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      failed = true;
      try {
        await client.query("ROLLBACK");
      } catch {
        /* Discard broken sockets. */
      }
      throw error;
    } finally {
      client.release(failed);
    }
  }
}
