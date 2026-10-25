import defaults from "../generated/defaults.json" with { type: "json" };
import type { Config } from "../generated/types/Config";

/** SSR-safe projection only. Rust owns the fields, defaults and validation. */
export function projectEngineConfig(input: Partial<Config>): Config {
  return Object.fromEntries(
    (Object.keys(defaults) as (keyof Config)[]).map((key) => {
      const value = input[key] ?? defaults[key];
      return [key, Array.isArray(value) ? [...value] : value];
    }),
  ) as Config;
}

export type { Config } from "../generated/types/Config";

const keys = Object.keys(defaults) as (keyof Config)[];

const same = (a: unknown, b: unknown): boolean =>
  a === b || (Number.isNaN(a) && Number.isNaN(b));

/**
 * Whether `projectEngineConfig(input)` would equal `projected`, without
 * allocating. Engine settings are primitives or arrays of primitives.
 */
export function engineConfigMatches(
  projected: Config,
  input: Partial<Config>,
): boolean {
  for (const key of keys) {
    const value: unknown = input[key] ?? defaults[key];
    const current: unknown = projected[key];
    if (Array.isArray(value)) {
      if (!Array.isArray(current) || current.length !== value.length) {
        return false;
      }
      for (let index = 0; index < value.length; index++) {
        if (!same(value[index], current[index])) return false;
      }
    } else if (!same(value, current)) {
      return false;
    }
  }
  return true;
}
