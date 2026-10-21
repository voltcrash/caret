import type { Config } from "@oxytype/schemas/configs";
import { ConfigSchema } from "@oxytype/schemas/configs";
import { typedKeys } from "@oxytype/util/objects";
import type { ZodType } from "zod";

import { getDefaultConfig } from "./default-config";
import { canSetConfigWithCurrentFunboxes } from "./funbox-validation";
import { sharedConfigMetadata, type SharedConfigMetadata } from "./metadata";
import { migrateConfig } from "./migrate";

type ConfigKey = keyof Config;

export type ConfigChange = {
  [K in ConfigKey]: { key: K; value: Config[K]; previousValue: Config[K] };
}[ConfigKey];

export type ConfigChangeFailure = {
  reason: "noQuit" | "blocked" | "invalid" | "funbox";
  key: ConfigKey;
  message: string;
};

export type ConfigChangeResult =
  | { ok: true; changes: ConfigChange[] }
  | ({ ok: false } & ConfigChangeFailure);

export type ConfigChangeOptions = {
  /** Value schema, e.g. `supportedConfigSchema`; defaults to the web schema. */
  schema?: { shape: Partial<Record<string, ZodType>> };
  /** A running test with the no_quit funbox blocks restarting settings. */
  testActive?: boolean;
  /** Client-only block reasons, checked after the shared rules. */
  blockedReason?: <K extends ConfigKey>(
    key: K,
    value: Config[K],
    config: Readonly<Config>,
  ) => string | undefined;
};

/**
 * Resolves one setting change like the web setter: value overrides, no_quit,
 * block rules, schema validity, funbox compatibility, then dependent settings.
 * Dependent changes come first; nothing is applied.
 */
export function resolveConfigChange<K extends ConfigKey>(
  key: K,
  value: Config[K],
  config: Readonly<Config>,
  options: ConfigChangeOptions = {},
): ConfigChangeResult {
  const working: Config = { ...config };
  const changes: ConfigChange[] = [];
  const failure = resolve(key, value, working, changes, options);
  return failure === undefined
    ? { ok: true, changes }
    : { ok: false, ...failure };
}

function resolve<K extends ConfigKey>(
  key: K,
  requested: Config[K],
  working: Config,
  changes: ConfigChange[],
  options: ConfigChangeOptions,
): ConfigChangeFailure | undefined {
  const metadata = sharedConfigMetadata[key] as SharedConfigMetadata<K>;
  const label = metadata.displayString ?? key;
  // Overrides normalize values before schema validation, but require the right
  // primitive/array type. Keep untyped callers out of those hooks.
  if (
    typeof requested !== typeof working[key] ||
    Array.isArray(requested) !== Array.isArray(working[key])
  ) {
    return {
      reason: "invalid",
      key,
      message: `Invalid value for ${label} (${String(requested)}). Please try to change this setting again.`,
    };
  }
  const value =
    metadata.overrideValue?.({
      value: requested,
      currentValue: working[key],
      currentConfig: working,
    }) ?? requested;

  if (
    metadata.changeRequiresRestart &&
    options.testActive === true &&
    working.funbox.includes("no_quit")
  ) {
    return {
      reason: "noQuit",
      key,
      message: "No quit funbox is active. Please finish the test.",
    };
  }
  const blocked =
    metadata.blockedReason?.({ value, currentConfig: working }) ??
    options.blockedReason?.(key, value, working);
  if (blocked !== undefined) {
    return { reason: "blocked", key, message: blocked };
  }
  const schema = (options.schema ?? ConfigSchema).shape[key];
  if (schema === undefined || !schema.safeParse(value).success) {
    return {
      reason: "invalid",
      key,
      message: `Invalid value for ${label} (${String(value)}). Please try to change this setting again.`,
    };
  }
  if (!canSetConfigWithCurrentFunboxes(key, value, working.funbox)) {
    return {
      reason: "funbox",
      key,
      message:
        key === "words" || key === "time"
          ? "Active funboxes do not support infinite tests"
          : `You can't set ${key
              .replace(/([A-Z])/g, " $1")
              .trim()
              .toLowerCase()} to ${String(value)} with currently active funboxes.`,
    };
  }

  const targets =
    metadata.overrideConfig?.({ value, currentConfig: working }) ?? {};
  for (const target of typedKeys(targets)) {
    const targetValue = targets[target];
    if (targetValue === undefined || working[target] === targetValue) continue;
    const failure = resolve(target, targetValue, working, changes, options);
    if (failure !== undefined) return failure;
  }

  changes.push({ key, value, previousValue: working[key] } as ConfigChange);
  working[key] = value;
  return undefined;
}

/** Settings whose rules change others; a full config applies them last. */
export const lastConfigsToApply: ReadonlySet<ConfigKey> = new Set<ConfigKey>([
  "keymapMode",
  "minWpm",
  "minAcc",
  "minBurst",
  "paceCaret",
  "quoteLength", //quote length sets mode,
  "words",
  "time",
  "mode", // mode sets punctuation and numbers
  "numbers",
  "punctuation",
  "funbox",
]);

/**
 * Applies a partial or full config onto the defaults like a web import.
 * Rejected values keep their defaults.
 */
export function resolveFullConfig(
  partial: object,
  options: ConfigChangeOptions = {},
): { config: Config; rejected: ConfigKey[] } {
  const full = migrateConfig(partial);
  const config = getDefaultConfig();
  const rejected: ConfigKey[] = [];
  const firstKeys = typedKeys(full).filter(
    (key) => !lastConfigsToApply.has(key),
  );
  for (const key of [...firstKeys, ...lastConfigsToApply]) {
    const result = resolveConfigChange(key, full[key], config, options);
    if (!result.ok) {
      rejected.push(key);
      continue;
    }
    for (const change of result.changes) {
      (config as Record<ConfigKey, unknown>)[change.key] = change.value;
    }
  }
  return { config, rejected };
}
