import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/node-postgres";
import { DatabaseClient } from "../db/connection";
import type {
  AnalyticsEngineDataset,
  ExecutionContext,
  Fetcher,
  KVNamespace,
  RateLimit,
} from "@cloudflare/workers-types";

export type WorkerEnv = {
  HYPERDRIVE: { connectionString: string };
  ASSETS?: Fetcher;
  CACHE?: KVNamespace;
  /** Per-request latency and database usage; see docs/CLOUDFLARE_OPERATIONS.md. */
  METRICS?: AnalyticsEngineDataset;
  MODE?: string;
  FRONTEND_URL?: string;
  SERVE_FRONTEND?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_API_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  INTEGRATION_URL?: string;
  INTEGRATION_SECRET?: string;
  QUOTES_REPOSITORY?: string;
  QUOTES_ASSET_URL?: string;
  API_PATH_OVERRIDE?: string;
  MAINTENANCE?: string;
  VERSION?: string;
  PLACEMENT_MODE?: string;
  /** Isolate configuration cache lifetime; tests set 0. */
  CONFIGURATION_CACHE_TTL_MS?: string;
  /** Workers rate limiting bindings; see `policies/rate-counter`. */
  [rateLimit: `RATE_LIMIT_${string}`]: RateLimit | undefined;
};

export type Runtime = {
  request?: { nonce: string; requestId: string };
  auth?: ReturnType<typeof import("../init/auth").createAuth>;
  configuration?: import("@caret/schemas/configuration").Configuration;
  env: WorkerEnv;
  db: ReturnType<typeof drizzle>;
  sql: DatabaseClient;
  execution?: Pick<ExecutionContext, "waitUntil">;
  metrics: InvocationMetrics;
};

export type InvocationMetrics = {
  /** Operations this invocation ran, in order. */
  operations: string[];
  /** Statements sent to PostgreSQL, including transaction members. */
  dbStatements: number;
};

const storage = new AsyncLocalStorage<Runtime>();

/** Scope bindings to an invocation, including concurrent requests in one isolate. */
export function withRuntime<T>(
  env: WorkerEnv,
  fn: () => T,
  execution?: Runtime["execution"],
): T {
  const metrics: InvocationMetrics = { operations: [], dbStatements: 0 };
  let sql: Runtime["sql"] | undefined;
  let db: Runtime["db"] | undefined;
  const scope: Runtime = {
    env,
    get sql(): Runtime["sql"] {
      if (!env.HYPERDRIVE?.connectionString)
        {throw new Error("HYPERDRIVE is required");}
      sql ??= new DatabaseClient(env.HYPERDRIVE.connectionString);
      return sql;
    },
    get db(): Runtime["db"] {
      db ??= drizzle(scope.sql, {
        logger: {
          logQuery: () => {
            metrics.dbStatements++;
          },
        },
      });
      return db;
    },
    execution,
    metrics,
  };
  const close = async (): Promise<void> => {
    await sql?.end();
  };
  try {
    const result = storage.run(scope, fn);
    if (result instanceof Promise) return result.finally(close) as T;
    void close();
    return result;
  } catch (error) {
    void close();
    throw error;
  }
}

export function runtime(): Runtime {
  const current = storage.getStore();
  if (!current) throw new Error("Worker runtime is not initialized");
  return current;
}

export function envValue(name: keyof WorkerEnv): string | undefined {
  const current = storage.getStore();
  const value = current ? current.env[name] : process.env[name];
  return typeof value === "string" ? value : undefined;
}

export function background(task: Promise<unknown>): void {
  const execution = storage.getStore()?.execution;
  const handled = task.catch((error: unknown) =>
    console.error("Background task failed", error),
  );
  execution?.waitUntil(handled);
}
