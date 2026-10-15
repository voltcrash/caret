import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/d1";
import type {
  D1Database,
  ExecutionContext,
  Fetcher,
  Queue,
  KVNamespace,
} from "@cloudflare/workers-types";

export type WorkerEnv = {
  DB: D1Database;
  TASKS?: Queue;
  ASSETS?: Fetcher;
  CACHE?: KVNamespace;
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
};

export type Runtime = {
  request?: { nonce: string; requestId: string };
  auth?: ReturnType<typeof import("../init/auth").createAuth>;
  configuration?: import("@oxytype/schemas/configuration").Configuration;
  env: WorkerEnv;
  db: ReturnType<typeof drizzle>;
  execution?: Pick<ExecutionContext, "waitUntil">;
};

const storage = new AsyncLocalStorage<Runtime>();

/** Scope bindings to an invocation, including concurrent requests in one isolate. */
export function withRuntime<T>(
  env: WorkerEnv,
  fn: () => T,
  execution?: Runtime["execution"],
): T {
  return storage.run({ env, db: drizzle(env.DB), execution }, fn);
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
