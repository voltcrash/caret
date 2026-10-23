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
