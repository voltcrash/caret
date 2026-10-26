import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/d1";
import type {
  AnalyticsEngineDataset,
  D1Database,
  D1DatabaseSession,
  ExecutionContext,
  Fetcher,
  KVNamespace,
  RateLimit,
} from "@cloudflare/workers-types";

export type WorkerEnv = {
  DB: D1Database;
  ASSETS?: Fetcher;
  CACHE?: KVNamespace;
  /** Per-request latency and D1 usage; see docs/CLOUDFLARE_OPERATIONS.md. */
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
  /**
   * First-query routing for this invocation's D1 session; fixed once the
   * session opens. See `preferReplicas`.
   */
  sessionConstraint: "first-primary" | "first-unconstrained";
  auth?: ReturnType<typeof import("../init/auth").createAuth>;
  configuration?: import("@caret/schemas/configuration").Configuration;
  env: WorkerEnv;
  db: ReturnType<typeof drizzle>;
  session: D1DatabaseSession;
  primaryDb: ReturnType<typeof drizzle>;
  execution?: Pick<ExecutionContext, "waitUntil">;
  metrics: InvocationMetrics;
};

export type InvocationMetrics = {
  /** Operations this invocation ran, in order. */
  operations: string[];
  /** Prepared D1 statements, including those sent in a batch. */
  d1Statements: number;
};

/** Counts statements without changing how bindings or sessions behave. */
function counted<T extends object>(target: T, metrics: InvocationMetrics): T {
  return new Proxy(target, {
    get(object, property) {
      const value: unknown = Reflect.get(object, property, object);
      if (typeof value !== "function") return value;
      return (...args: unknown[]): unknown => {
        if (property === "prepare") metrics.d1Statements++;
        return Reflect.apply(value, object, args) as unknown;
      };
    },
  });
}

const storage = new AsyncLocalStorage<Runtime>();

/** Scope bindings to an invocation, including concurrent requests in one isolate. */
export function withRuntime<T>(
  env: WorkerEnv,
  fn: () => T,
  execution?: Runtime["execution"],
): T {
  // Start fresh on every invocation; subsequent reads may use replicas without
  // going backwards or missing this invocation's writes. Never share sessions.
  const metrics: InvocationMetrics = { operations: [], d1Statements: 0 };
  let session: D1DatabaseSession | undefined;
  let db: Runtime["db"] | undefined;
  const scope: Runtime = {
    env,
    sessionConstraint: "first-primary",
    // Opened on first use so `preferReplicas` can still choose its routing.
    get session(): D1DatabaseSession {
      session ??= counted(env.DB.withSession(scope.sessionConstraint), metrics);
      return session;
    },
    set session(value: D1DatabaseSession) {
      session = value;
    },
    get db(): Runtime["db"] {
      db ??= drizzle(scope.session);
      return db;
    },
    primaryDb: drizzle(counted(env.DB, metrics)),
    execution,
    metrics,
  };
  return storage.run(scope, fn);
}

/**
 * Let this invocation's first D1 read use any replica. Only for invocations
 * whose every read tolerates replication lag (shared, edge-cached public
 * reads); writes still route to the primary. No effect once the session is
 * open.
 */
export function preferReplicas(): void {
  const scope = storage.getStore();
  if (scope) scope.sessionConstraint = "first-unconstrained";
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
