import { eq } from "drizzle-orm";
import { database, encode, statement } from "../db/client";
import { configuration as configurationTable } from "../db/schema";
import { runtime } from "../runtime/env";
import { identity, isPlainObject } from "../utils/misc";
import { BASE_CONFIGURATION } from "../constants/base-configuration";
import type { Configuration } from "@caret/schemas/configuration";
import type { PartialConfiguration } from "@caret/contracts/configuration";
import { intersect } from "@caret/util/arrays";

function mergeConfigurations(
  baseConfiguration: Configuration,
  liveConfiguration: PartialConfiguration,
): void {
  if (!isPlainObject(baseConfiguration) || !isPlainObject(liveConfiguration)) {
    return;
  }

  function merge(base: object, source: object): void {
    const commonKeys = intersect(Object.keys(base), Object.keys(source), true);

    commonKeys.forEach((key) => {
      const baseValue = base[key] as object;
      const sourceValue = source[key] as object;

      const isBaseValueObject = isPlainObject(baseValue);
      const isSourceValueObject = isPlainObject(sourceValue);

      if (isBaseValueObject && isSourceValueObject) {
        merge(baseValue, sourceValue);
      } else if (identity(baseValue) === identity(sourceValue)) {
        base[key] = sourceValue;
      }
    });
  }

  merge(baseConfiguration, liveConfiguration);
}

/** Isolate-wide; requests clone a snapshot so services never share mutations. */
const DEFAULT_CACHE_TTL_MS = 30_000;
type CacheEntry = { loaded: Promise<Configuration>; expiresAt: number };
const isolateCache = new WeakMap<object, CacheEntry>();

function cacheTtl(): number {
  const value = Number(runtime().env.CONFIGURATION_CACHE_TTL_MS);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_CACHE_TTL_MS;
}

/**
 * Request-stable configuration. Within an isolate, PostgreSQL is read at most once per
 * TTL per database; other isolates converge within the TTL after a patch.
 */
export async function getCachedConfiguration(
  _attemptCacheUpdate = false,
): Promise<Configuration> {
  const scope = runtime();
  if (scope.configuration !== undefined) return scope.configuration;
  const key = scope.env;
  const ttl = cacheTtl();
  let entry = ttl === 0 ? undefined : isolateCache.get(key);
  if (entry === undefined || entry.expiresAt <= Date.now()) {
    entry = { loaded: loadConfiguration(), expiresAt: Date.now() + ttl };
    isolateCache.set(key, entry);
    // Never cache a failed read.
    entry.loaded.catch(() => {
      if (isolateCache.get(key) === entry) isolateCache.delete(key);
    });
  }
  scope.configuration ??= structuredClone(await entry.loaded);
  return scope.configuration;
}
export async function getLiveConfiguration(): Promise<Configuration> {
  const configuration = await loadConfiguration();
  const scope = runtime();
  isolateCache.set(scope.env, {
    loaded: Promise.resolve(configuration),
    expiresAt: Date.now() + cacheTtl(),
  });
  scope.configuration = structuredClone(configuration);
  return scope.configuration;
}
async function loadConfiguration(): Promise<Configuration> {
  const row = (
    await database()
      .select()
      .from(configurationTable)
      .where(eq(configurationTable.id, "main"))
      .limit(1)
  )[0];
  const configuration = structuredClone(BASE_CONFIGURATION);
  if (row) {
    mergeConfigurations(configuration, row.data);
  } else {
    await database()
      .insert(configurationTable)
      .values({ id: "main", data: configuration })
      .onConflictDoNothing();
  }
  return configuration;
}
export async function patchConfiguration(
  updates: PartialConfiguration,
): Promise<boolean> {
  await getCachedConfiguration();
  await statement(
    "UPDATE configuration SET data=jsonb_merge_patch(data,?::jsonb),version=version+1 WHERE id='main'",
    encode(updates),
  ).run();
  await getLiveConfiguration();
  return true;
}
export const __testing = { mergeConfigurations };
